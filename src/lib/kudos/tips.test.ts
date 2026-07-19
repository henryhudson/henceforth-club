import { describe, it, expect } from "vitest";
import type { Redis } from "@upstash/redis";
import { TIP_PRIORITY_FLOOR, TIP_PRIORITY_HALF_LIFE_DAYS } from "./constants";
import { readProfileAccount, readHandleAccount, fundFloat } from "./float";
import { readKudosReceived } from "./received";
import {
  decayedPriority,
  readTipCount,
  readTipCounts,
  readTipPriorities,
  readTipPriority,
  recordTip,
  type TipPriorityRecord,
} from "./tips";

const DAY = "2026-07-18";

/** A minimal in-memory stand-in for the Upstash client — only the calls the
 * tip path actually makes: `incrby`, `decrby`, `get`, `set`, plus the
 * `rpush`/`lrange` pair behind the day's received stream. An optional
 * trace records every command and key, which is how the no-Elo-write test
 * watches the path's entire Redis footprint. */
function fakeRedis(trace?: (command: string, key: string) => void): Redis {
  const store = new Map<string, unknown>();
  const bump = (key: string, by: number) => {
    const next = ((store.get(key) as number | undefined) ?? 0) + by;
    store.set(key, next);
    return next;
  };
  return {
    rpush: async (key: string, ...values: unknown[]) => {
      trace?.("rpush", key);
      const list = (store.get(key) as unknown[] | undefined) ?? [];
      list.push(...values);
      store.set(key, list);
      return list.length;
    },
    lrange: async (key: string, start: number, stop: number) => {
      trace?.("lrange", key);
      const list = (store.get(key) as unknown[] | undefined) ?? [];
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    },
    incrby: async (key: string, by: number) => {
      trace?.("incrby", key);
      return bump(key, by);
    },
    decrby: async (key: string, by: number) => {
      trace?.("decrby", key);
      return bump(key, -by);
    },
    get: async (key: string) => {
      trace?.("get", key);
      return store.get(key) ?? null;
    },
    mget: async (...keys: string[]) => {
      for (const key of keys) trace?.("mget", key);
      return keys.map((key) => store.get(key) ?? null);
    },
    set: async (key: string, value: unknown) => {
      trace?.("set", key);
      store.set(key, value);
      return "OK";
    },
  } as unknown as Redis;
}

describe("decayedPriority", () => {
  const record = (value: number, day: string): TipPriorityRecord => ({ value, day });

  it("returns the full value on the day of the bump", () => {
    expect(decayedPriority(record(100, DAY), DAY)).toBe(100);
  });

  it("halves after one half-life", () => {
    expect(decayedPriority(record(100, "2026-07-18"), "2026-07-25")).toBeCloseTo(50);
    expect(TIP_PRIORITY_HALF_LIFE_DAYS).toBe(7);
  });

  it("quarters after two half-lives", () => {
    expect(decayedPriority(record(100, "2026-07-04"), DAY)).toBeCloseTo(25);
  });

  it("floors to exactly zero once the decayed value drops below one kudos", () => {
    // 100 kudos is under the floor after seven half-lives (100/128 < 1).
    expect(decayedPriority(record(100, "2026-05-30"), DAY)).toBe(0);
    expect(TIP_PRIORITY_FLOOR).toBe(1);
  });

  it("reads zero for an unreadable day rather than poisoning the dealer with NaN", () => {
    expect(decayedPriority(record(100, "not-a-day"), DAY)).toBe(0);
    expect(decayedPriority(record(100, DAY), "not-a-day")).toBe(0);
  });

  it("never grows: a bump dated in the future decays as if it were today", () => {
    expect(decayedPriority(record(100, "2026-07-25"), DAY)).toBe(100);
  });
});

describe("recordTip", () => {
  it("debits the float, ticks the public count, accrues to the author, and bumps priority", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 2000, redis);

    const result = await recordTip("alice", "post-1", "bob", 30, DAY, redis);

    expect(result).toEqual({ kind: "recorded", float: 1970, tipped: 30, priority: 30 });
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 2000, float: 1970, spent: 30 });
    expect(await readHandleAccount("bob", redis)).toEqual({ earned: 30, settled: 0 });
    expect(await readTipCount("post-1", redis)).toBe(30);
    expect(await readTipPriority("post-1", DAY, redis)).toBe(30);
  });

  it("lands the day's received entry — the Top chart's input, giver never recorded", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 2000, redis);

    await recordTip("alice", "post-1", "bob", 30, DAY, redis);

    expect(await readKudosReceived(DAY, redis)).toEqual([
      { postId: "post-1", author: "bob", amount: 30, kind: "tip" },
    ]);
  });

  it("accumulates across tips, decaying the standing priority before adding the new bump", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 2000, redis);

    await recordTip("alice", "post-1", "bob", 100, "2026-07-11", redis);
    const later = await recordTip("alice", "post-1", "bob", 10, DAY, redis);

    // One half-life on: 100 decays to 50, plus the fresh 10.
    expect(later.kind).toBe("recorded");
    if (later.kind === "recorded") expect(later.priority).toBeCloseTo(60);
    // The public count never decays — it is a tally, not an exposure weight.
    expect(await readTipCount("post-1", redis)).toBe(110);
    expect(await readHandleAccount("bob", redis)).toEqual({ earned: 110, settled: 0 });
  });

  it("carries no daily cap — tips are applause, not duels", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 500, redis);
    for (let i = 0; i < 300; i++) {
      expect((await recordTip("alice", "post-1", "bob", 1, DAY, redis)).kind).toBe("recorded");
    }
    expect(await readTipCount("post-1", redis)).toBe(300);
  });

  it("refuses an overdraft before anything is touched: no count, no accrual, no priority", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 20, redis);

    expect(await recordTip("alice", "post-1", "bob", 30, DAY, redis)).toEqual({
      kind: "insufficient",
      float: 20,
    });
    expect(await readProfileAccount("alice", redis)).toEqual({ funded: 20, float: 20, spent: 0 });
    expect(await readHandleAccount("bob", redis)).toEqual({ earned: 0, settled: 0 });
    expect(await readTipCount("post-1", redis)).toBe(0);
    expect(await readTipPriority("post-1", DAY, redis)).toBe(0);
    expect(await readKudosReceived(DAY, redis)).toEqual([]);
  });

  it("rejects non-positive and non-integer amounts, touching nothing", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 100, redis);
    for (const amount of [0, -5, 1.5, Number.NaN]) {
      expect(await recordTip("alice", "post-1", "bob", amount, DAY, redis)).toEqual({
        kind: "invalid",
      });
    }
    expect(await readTipCount("post-1", redis)).toBe(0);
  });

  it("is null-Redis safe: unavailable", async () => {
    expect(await recordTip("alice", "post-1", "bob", 1, DAY, null)).toEqual({
      kind: "unavailable",
    });
  });
});

describe("readers", () => {
  it("read zero for a post nobody has tipped", async () => {
    const redis = fakeRedis();
    expect(await readTipCount("post-9", redis)).toBe(0);
    expect(await readTipPriority("post-9", DAY, redis)).toBe(0);
  });

  it("are null-Redis safe: zero", async () => {
    expect(await readTipCount("post-1", null)).toBe(0);
    expect(await readTipPriority("post-1", DAY, null)).toBe(0);
  });
});

describe("readTipPriorities — the dealer's bulk read", () => {
  it("reads every post's decayed priority in one round trip, zero for the untipped", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 1000, redis);
    await recordTip("alice", "post-1", "bob", 40, DAY, redis);
    await recordTip("alice", "post-2", "carol", 16, "2026-07-11", redis);

    const priorities = await readTipPriorities(["post-1", "post-2", "post-9"], DAY, redis);
    expect(priorities["post-1"]).toBe(40);
    // Tipped a half-life of days ago: 16 has decayed to 8 by DAY.
    expect(TIP_PRIORITY_HALF_LIFE_DAYS).toBe(7);
    expect(priorities["post-2"]).toBeCloseTo(8, 10);
    expect(priorities["post-9"]).toBe(0);
  });

  it("matches the single reader post for post", async () => {
    const redis = fakeRedis();
    await fundFloat("alice", 1000, redis);
    await recordTip("alice", "post-1", "bob", 25, "2026-07-04", redis);

    const bulk = await readTipPriorities(["post-1"], DAY, redis);
    expect(bulk["post-1"]).toBe(await readTipPriority("post-1", DAY, redis));
  });

  it("is total on an empty list and null-Redis safe: zeros", async () => {
    expect(await readTipPriorities([], DAY, fakeRedis())).toEqual({});
    expect(await readTipPriorities(["post-1", "post-2"], DAY, null)).toEqual({
      "post-1": 0,
      "post-2": 0,
    });
  });
});

describe("no Elo write anywhere in the tip path", () => {
  // The design's structural promise: a proper Elo cannot ingest single-sided
  // applause, so the tip path must never touch the duel ledger, its sequence
  // counter, or the fold checkpoint. This test watches every Redis command
  // the path issues, across success, overdraft, invalid input and the
  // readers, and pins the whole footprint to the tip path's own keys.
  const ELO_KEYS = ["kudos:duels", "kudos:duels:seq", "kudos:fold:checkpoint"];
  const ALLOWED_PREFIXES = [
    "kudos:funded:",
    "kudos:float:",
    "kudos:spent:",
    "kudos:earned:",
    "kudos:tips:",
    "kudos:priority:",
    "kudos:received:",
  ];

  it("touches only float, spend, earned, tip-count, priority and received keys", async () => {
    const touched: { command: string; key: string }[] = [];
    const redis = fakeRedis((command, key) => touched.push({ command, key }));
    await fundFloat("alice", 100, redis);

    await recordTip("alice", "post-1", "bob", 30, DAY, redis);
    await recordTip("alice", "post-1", "bob", 500, DAY, redis); // insufficient
    await recordTip("alice", "post-1", "bob", 0.5, DAY, redis); // invalid
    await readTipCount("post-1", redis);
    await readTipPriority("post-1", DAY, redis);

    expect(touched.length).toBeGreaterThan(0);
    for (const { key } of touched) {
      expect(ELO_KEYS).not.toContain(key);
      expect(ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))).toBe(true);
    }
  });
});

describe("readTipCounts — the feed's bulk read", () => {
  it("reads every post's public count in one round trip, missing counts as zero", async () => {
    const redis = fakeRedis();
    await fundFloat("giver", 100, redis);
    await recordTip("giver", "post-a", "author", 5, DAY, redis);
    await recordTip("giver", "post-a", "author", 2, DAY, redis);

    const counts = await readTipCounts(["post-a", "post-b"], redis);
    expect(counts).toEqual({ "post-a": 7, "post-b": 0 });
  });

  it("is total on an empty list and null-Redis safe", async () => {
    expect(await readTipCounts([], fakeRedis())).toEqual({});
    expect(await readTipCounts(["post-a"], null)).toEqual({ "post-a": 0 });
  });
});
