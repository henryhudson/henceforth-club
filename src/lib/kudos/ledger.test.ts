import { describe, it, expect } from "vitest";
import type { Redis } from "@upstash/redis";
import { foldDuels, type Checkpoint } from "./elo";
import {
  appendDuel,
  readCheckpoint,
  readDuelLedger,
  readDuelsSince,
  readRatingTable,
  strikeDuels,
  writeCheckpoint,
} from "./ledger";

function duel(overrides: Partial<{ duelId: string; winnerPostId: string; loserPostId: string; day: string }> = {}) {
  return {
    duelId: overrides.duelId ?? "duel-1",
    winnerPostId: overrides.winnerPostId ?? "post-a",
    loserPostId: overrides.loserPostId ?? "post-b",
    day: overrides.day ?? "2026-07-18",
  };
}

/** A minimal in-memory stand-in for the Upstash client — only the calls the
 * ledger actually makes: `incr`, `rpush`, `lrange`, `lrem`, `get`, `set`,
 * `del`. Like the real client, values round-trip through JSON and `lrem`
 * matches on serialised equality. */
function fakeRedis(): Redis {
  const strings = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const counters = new Map<string, number>();
  return {
    incr: async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
    rpush: async (key: string, ...elements: unknown[]) => {
      const list = lists.get(key) ?? [];
      list.push(...elements.map((e) => JSON.stringify(e)));
      lists.set(key, list);
      return list.length;
    },
    lrange: async <T,>(key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      const slice = stop === -1 ? list.slice(start) : list.slice(start, stop + 1);
      return slice.map((raw) => JSON.parse(raw)) as T[];
    },
    lrem: async (key: string, count: number, value: unknown) => {
      const target = JSON.stringify(value);
      const list = lists.get(key) ?? [];
      let removed = 0;
      const kept = list.filter((raw) => {
        if (raw === target && (count === 0 || removed < count)) {
          removed++;
          return false;
        }
        return true;
      });
      lists.set(key, kept);
      return removed;
    },
    get: async <T,>(key: string) => {
      const raw = strings.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    },
    set: async (key: string, value: unknown) => {
      strings.set(key, JSON.stringify(value));
      return "OK";
    },
    del: async (...keys: string[]) =>
      keys.reduce((n, key) => n + (strings.delete(key) ? 1 : 0), 0),
  } as unknown as Redis;
}

describe("appendDuel", () => {
  it("appends entries oldest-first with a monotone seq starting at 1", async () => {
    const redis = fakeRedis();

    const first = await appendDuel(duel({ duelId: "d1" }), redis);
    const second = await appendDuel(duel({ duelId: "d2", winnerPostId: "post-c" }), redis);

    expect(first).toEqual({
      kind: "recorded",
      entry: { seq: 1, duelId: "d1", winnerPostId: "post-a", loserPostId: "post-b", day: "2026-07-18" },
    });
    expect(second.kind).toBe("recorded");
    expect(await readDuelLedger(redis)).toEqual([
      { seq: 1, duelId: "d1", winnerPostId: "post-a", loserPostId: "post-b", day: "2026-07-18" },
      { seq: 2, duelId: "d2", winnerPostId: "post-c", loserPostId: "post-b", day: "2026-07-18" },
    ]);
  });

  it("reports unavailable (recording nothing) when Redis is not configured", async () => {
    expect(await appendDuel(duel(), null)).toEqual({ kind: "unavailable" });
  });
});

describe("readDuelsSince", () => {
  it("returns only entries after the given seq; zero means the whole ledger", async () => {
    const redis = fakeRedis();
    await appendDuel(duel({ duelId: "d1" }), redis);
    await appendDuel(duel({ duelId: "d2" }), redis);
    await appendDuel(duel({ duelId: "d3" }), redis);

    const tail = await readDuelsSince(2, redis);

    expect(tail.map((e) => e.duelId)).toEqual(["d3"]);
    expect((await readDuelsSince(0, redis)).map((e) => e.duelId)).toEqual(["d1", "d2", "d3"]);
    expect(await readDuelsSince(3, redis)).toEqual([]);
  });

  it("is null-Redis safe: empty", async () => {
    expect(await readDuelsSince(0, null)).toEqual([]);
    expect(await readDuelLedger(null)).toEqual([]);
  });
});

describe("checkpoint", () => {
  it("round-trips a checkpoint and reads null when none has been written", async () => {
    const redis = fakeRedis();
    const checkpoint: Checkpoint = {
      seq: 2,
      table: { "post-a": { rating: 1520, duels: 1 }, "post-b": { rating: 1480, duels: 1 } },
    };

    expect(await readCheckpoint(redis)).toBeNull();
    expect(await writeCheckpoint(checkpoint, redis)).toBe("written");
    expect(await readCheckpoint(redis)).toEqual(checkpoint);
  });

  it("is null-Redis safe: read null, write unavailable", async () => {
    expect(await readCheckpoint(null)).toBeNull();
    expect(await writeCheckpoint({ seq: 1, table: {} }, null)).toBe("unavailable");
  });
});

describe("readRatingTable", () => {
  it("equals the pure fold of the whole ledger", async () => {
    const redis = fakeRedis();
    await appendDuel(duel({ duelId: "d1", winnerPostId: "a", loserPostId: "b" }), redis);
    await appendDuel(duel({ duelId: "d2", winnerPostId: "b", loserPostId: "c" }), redis);
    await appendDuel(duel({ duelId: "d3", winnerPostId: "a", loserPostId: "c" }), redis);

    expect(await readRatingTable(redis)).toEqual(foldDuels(await readDuelLedger(redis)));
  });

  it("resumes from a checkpoint and matches the full fold exactly", async () => {
    const redis = fakeRedis();
    await appendDuel(duel({ duelId: "d1", winnerPostId: "a", loserPostId: "b" }), redis);
    await appendDuel(duel({ duelId: "d2", winnerPostId: "b", loserPostId: "c" }), redis);
    const asOfTwo = foldDuels(await readDuelLedger(redis));
    await writeCheckpoint({ seq: 2, table: asOfTwo }, redis);
    await appendDuel(duel({ duelId: "d3", winnerPostId: "a", loserPostId: "c" }), redis);

    expect(await readRatingTable(redis)).toEqual(foldDuels(await readDuelLedger(redis)));
  });

  it("is null-Redis safe: empty table", async () => {
    expect(await readRatingTable(null)).toEqual({});
  });
});

describe("strikeDuels", () => {
  it("removes exactly the named duels and reports the ones it could not find", async () => {
    const redis = fakeRedis();
    await appendDuel(duel({ duelId: "d1" }), redis);
    await appendDuel(duel({ duelId: "d2" }), redis);
    await appendDuel(duel({ duelId: "d3" }), redis);

    const result = await strikeDuels(["d2", "nope"], redis);

    expect(result).toEqual({ kind: "struck", struck: ["d2"], missing: ["nope"] });
    expect((await readDuelLedger(redis)).map((e) => e.duelId)).toEqual(["d1", "d3"]);
  });

  it("invalidates the checkpoint so a correction is a replay, never a patch", async () => {
    const redis = fakeRedis();
    await appendDuel(duel({ duelId: "d1", winnerPostId: "a", loserPostId: "b" }), redis);
    await appendDuel(duel({ duelId: "d2", winnerPostId: "a", loserPostId: "b" }), redis);
    await writeCheckpoint({ seq: 2, table: foldDuels(await readDuelLedger(redis)) }, redis);

    await strikeDuels(["d2"], redis);

    expect(await readCheckpoint(redis)).toBeNull();
    // The replayed table is the fold of what remains — the struck duel has
    // left no trace through the stale checkpoint.
    expect(await readRatingTable(redis)).toEqual(foldDuels(await readDuelLedger(redis)));
  });

  it("never reuses a struck seq: the counter only moves forward", async () => {
    const redis = fakeRedis();
    await appendDuel(duel({ duelId: "d1" }), redis);
    await appendDuel(duel({ duelId: "d2" }), redis);
    await strikeDuels(["d2"], redis);

    const next = await appendDuel(duel({ duelId: "d3" }), redis);

    expect(next.kind === "recorded" && next.entry.seq).toBe(3);
  });

  it("is null-Redis safe: unavailable", async () => {
    expect(await strikeDuels(["d1"], null)).toEqual({ kind: "unavailable" });
  });
});
