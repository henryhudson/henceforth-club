import { describe, it, expect } from "vitest";
import type { Redis } from "@upstash/redis";
import { backfillFoundingVotes, splitFeeByWeights } from "./foundingBackfill";
import { readScores } from "./xVotes";

/** A minimal in-memory stand-in for the Upstash client — only the calls
 * xVotes actually makes: `set` (with nx), `rpush`, `lrange`. Hands back the
 * underlying lists so a test can simulate a ledger correction (an entry
 * removed) without a Redis API call. */
function fakeRedis(): {
  redis: Redis;
  lists: Map<string, unknown[]>;
} {
  const strings = new Map<string, unknown>();
  const lists = new Map<string, unknown[]>();
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
  } as unknown as Redis;
  return { redis, lists };
}

describe("backfillFoundingVotes", () => {
  it("appends one founding vote per post from its inscription fee, idempotently", async () => {
    const r = fakeRedis();
    const posts = [{ id: "p1", txid: "insc1" }];
    const txTimes = { insc1: Math.floor(Date.parse("2026-07-08T00:00:00Z") / 1000) };
    const feeOf = async (txid: string) => (txid === "insc1" ? 1000 : null);
    const first = await backfillFoundingVotes("alice", posts, txTimes, { feeOf, redis: r.redis });
    const again = await backfillFoundingVotes("alice", posts, txTimes, { feeOf, redis: r.redis });
    expect(first).toEqual({ recorded: 1, duplicate: 0, skipped: 0 });
    expect(again).toEqual({ recorded: 0, duplicate: 1, skipped: 0 }); // idempotent
    expect(await readScores("alice", "week", "2026-07-10", r.redis)).toEqual({ p1: 1000 });
  });

  it("splits a shared transaction's fee across its posts, one fee fetch per txid", async () => {
    const r = fakeRedis();
    const posts = [{ id: "p1", txid: "T" }, { id: "p2", txid: "T" }, { id: "p3", txid: "T" }];
    const txTimes = { T: Math.floor(Date.parse("2026-07-08T00:00:00Z") / 1000) };
    let calls = 0;
    const feeOf = async (txid: string) => { calls++; return txid === "T" ? 900 : null; };
    const res = await backfillFoundingVotes("alice", posts, txTimes, { feeOf, redis: r.redis });
    expect(res).toEqual({ recorded: 3, duplicate: 0, skipped: 0 });
    expect(calls).toBe(1);                              // one fetch per txid, not per post
    expect(await readScores("alice", "week", "2026-07-10", r.redis)).toEqual({ p1: 300, p2: 300, p3: 300 }); // 900/3
  });
});

describe("splitFeeByWeights", () => {
  it("splits proportionally and sums to exactly the fee", () => {
    const shares = splitFeeByWeights(1000, [3_000_000, 40, 40]);
    expect(shares.reduce((s, v) => s + v, 0)).toBe(1000);
    expect(shares[0]).toBeGreaterThan(990); // the 3 MB post bears almost all of it
  });

  it("never invents or loses a satoshi under awkward rounding", () => {
    for (const fee of [1, 7, 99, 3_194_242]) {
      const shares = splitFeeByWeights(fee, [1, 1, 1]);
      expect(shares.reduce((s, v) => s + v, 0)).toBe(fee);
    }
  });

  it("falls back to an equal split when no weights are known (the legacy behaviour)", () => {
    const shares = splitFeeByWeights(100, [0, 0, 0, 0]);
    expect(shares).toEqual([25, 25, 25, 25]);
  });

  it("is deterministic: equal fractional remainders go to the earlier index", () => {
    expect(splitFeeByWeights(3, [1, 1])).toEqual([2, 1]);
  });
});

describe("weighted backfill", () => {
  it("a photo post bears its byte share; text posts bear theirs", async () => {
    const r = fakeRedis();
    const res = await backfillFoundingVotes(
      "alice",
      [
        { id: "photo", txid: "tx1", weight: 2_000_000 },
        { id: "text1", txid: "tx1", weight: 100 },
        { id: "text2", txid: "tx1", weight: 100 },
      ],
      {},
      { feeOf: async () => 200_020, redis: r.redis },
    );
    expect(res).toEqual({ recorded: 3, duplicate: 0, skipped: 0 });
    const scores = await readScores("alice", "all", "2026-07-12", r.redis);
    expect(scores.photo + scores.text1 + scores.text2).toBe(200_020);
    expect(scores.photo).toBeGreaterThan(199_900);
    expect(scores.text1).toBeGreaterThan(0); // even the smallest post carries real cost
  });
});
