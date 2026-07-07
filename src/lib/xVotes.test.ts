import { describe, it, expect } from "vitest";
import type { Redis } from "@upstash/redis";
import { appendVote, readVoteLedger, rebuildScoreCache } from "./xVotes";
import { foldScores, type VoteLedgerEntry } from "./xScore";

function vote(overrides: Partial<VoteLedgerEntry> = {}): VoteLedgerEntry {
  return {
    txid: overrides.txid ?? "tx-default",
    postId: overrides.postId ?? "post-1",
    dir: overrides.dir ?? "up",
    sats: overrides.sats ?? 1000,
    day: overrides.day ?? "2026-07-01",
    ...overrides,
  };
}

/** A minimal in-memory stand-in for the Upstash client — only the calls
 * xVotes actually makes: `set` (with nx), `rpush`, `lrange`, `del`, `zadd`.
 * Hands back the underlying stores so a test can inspect the score cache and
 * simulate a ledger correction (an entry removed) without a Redis API call. */
function fakeRedis(): {
  redis: Redis;
  lists: Map<string, unknown[]>;
  zsetOf: (key: string) => Map<string, number> | undefined;
} {
  const strings = new Map<string, unknown>();
  const lists = new Map<string, unknown[]>();
  const zsets = new Map<string, Map<string, number>>();
  const redis = {
    set: async (key: string, value: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && strings.has(key)) return null;
      strings.set(key, value);
      return "OK";
    },
    rpush: async (key: string, ...elements: unknown[]) => {
      const list = lists.get(key) ?? [];
      list.push(...elements);
      lists.set(key, list);
      return list.length;
    },
    lrange: async <T,>(key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      return (stop === -1 ? list.slice(start) : list.slice(start, stop + 1)) as T[];
    },
    del: async (...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (strings.delete(key)) removed++;
        if (lists.delete(key)) removed++;
        if (zsets.delete(key)) removed++;
      }
      return removed;
    },
    zadd: async (key: string, ...members: Array<{ score: number; member: string }>) => {
      const zset = zsets.get(key) ?? new Map<string, number>();
      for (const { score, member } of members) zset.set(member, score);
      zsets.set(key, zset);
      return members.length;
    },
  } as unknown as Redis;
  return { redis, lists, zsetOf: (key) => zsets.get(key) };
}

/** The score cache as a plain postId -> score object, for comparison against
 * the pure fold. */
function cacheTable(zset: Map<string, number> | undefined): Record<string, number> {
  return Object.fromEntries(zset ?? []);
}

describe("appendVote", () => {
  it("appends the vote to the handle's ledger and rebuilds the cache to exactly the fold", async () => {
    const { redis, zsetOf } = fakeRedis();
    const entry = vote({ txid: "a", postId: "p1", sats: 700, day: "2026-07-01" });

    const result = await appendVote("Henry", entry, "2026-07-01", redis);

    expect(result).toBe("recorded");
    expect(await readVoteLedger("henry", redis)).toEqual([entry]);
    expect(cacheTable(zsetOf("x:score:henry"))).toEqual(foldScores([entry], "2026-07-01"));
  });

  it("counts a funding transaction exactly once: a replayed txid is a duplicate and changes nothing", async () => {
    const { redis, zsetOf } = fakeRedis();
    const entry = vote({ txid: "a", sats: 700 });

    await appendVote("henry", entry, "2026-07-01", redis);
    const second = await appendVote("henry", vote({ txid: "a", sats: 9999 }), "2026-07-01", redis);

    expect(second).toBe("duplicate");
    expect(await readVoteLedger("henry", redis)).toEqual([entry]);
    expect(cacheTable(zsetOf("x:score:henry"))).toEqual(foldScores([entry], "2026-07-01"));
  });

  it("gates a txid globally: the same funding transaction cannot vote on a second handle either", async () => {
    const { redis } = fakeRedis();

    await appendVote("henry", vote({ txid: "a" }), "2026-07-01", redis);
    const elsewhere = await appendVote("other", vote({ txid: "a" }), "2026-07-01", redis);

    expect(elsewhere).toBe("duplicate");
    expect(await readVoteLedger("other", redis)).toEqual([]);
  });

  it("keeps the ledger append-only and oldest-first across appends", async () => {
    const { redis } = fakeRedis();
    const first = vote({ txid: "a", day: "2026-06-01" });
    const second = vote({ txid: "b", day: "2026-07-01" });

    await appendVote("henry", first, "2026-07-01", redis);
    await appendVote("henry", second, "2026-07-01", redis);

    expect(await readVoteLedger("henry", redis)).toEqual([first, second]);
  });

  it("reports unavailable (recording nothing) when Redis is not configured", async () => {
    expect(await appendVote("henry", vote(), "2026-07-01", null)).toBe("unavailable");
  });
});

describe("readVoteLedger", () => {
  it("reads an empty ledger for a handle nobody has voted on", async () => {
    const { redis } = fakeRedis();
    expect(await readVoteLedger("henry", redis)).toEqual([]);
  });

  it("reads an empty ledger when Redis is not configured", async () => {
    expect(await readVoteLedger("henry", null)).toEqual([]);
  });
});

describe("rebuildScoreCache", () => {
  it("replays a corrected ledger exactly: a removed entry's influence vanishes from the cache", async () => {
    const { redis, lists, zsetOf } = fakeRedis();
    const sound = vote({ txid: "a", postId: "p1", sats: 1000, day: "2026-06-01" });
    const mistake = vote({ txid: "double-spent", postId: "p2", sats: 5000, day: "2026-07-01" });
    await appendVote("henry", sound, "2026-07-01", redis);
    await appendVote("henry", mistake, "2026-07-01", redis);

    // The daily pass catches the double-spend and strikes it from the ledger.
    lists.set("x:ledger:henry", [sound]);
    const rebuilt = await rebuildScoreCache("henry", "2026-07-01", redis);

    expect(rebuilt).toBe(true);
    // Replay, never patch: the cache equals the fold of the corrected ledger,
    // and the struck post's member is gone entirely — not zeroed, gone.
    expect(cacheTable(zsetOf("x:score:henry"))).toEqual(foldScores([sound], "2026-07-01"));
    expect(zsetOf("x:score:henry")?.has("p2")).toBe(false);
  });

  it("clears the cache when the ledger is empty", async () => {
    const { redis, lists, zsetOf } = fakeRedis();
    await appendVote("henry", vote(), "2026-07-01", redis);
    lists.set("x:ledger:henry", []);

    await rebuildScoreCache("henry", "2026-07-01", redis);

    expect(cacheTable(zsetOf("x:score:henry"))).toEqual({});
  });

  it("reports failure without throwing when Redis is not configured", async () => {
    expect(await rebuildScoreCache("henry", "2026-07-01", null)).toBe(false);
  });
});
