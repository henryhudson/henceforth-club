import { describe, it, expect } from "vitest";
import type { Redis } from "@upstash/redis";
import { appendVote, appendFoundingVote, readVoteLedger, readScores } from "./xVotes";
import type { VoteLedgerEntry } from "./xScore";

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

describe("appendVote", () => {
  it("appends the vote to the handle's ledger", async () => {
    const { redis } = fakeRedis();
    const entry = vote({ txid: "a", postId: "p1", sats: 700, day: "2026-07-01" });

    const result = await appendVote("Henry", entry, "2026-07-01", redis);

    expect(result).toBe("recorded");
    expect(await readVoteLedger("henry", redis)).toEqual([entry]);
  });

  it("counts a funding transaction exactly once: a replayed txid is a duplicate and changes nothing", async () => {
    const { redis } = fakeRedis();
    const entry = vote({ txid: "a", sats: 700 });

    await appendVote("henry", entry, "2026-07-01", redis);
    const second = await appendVote("henry", vote({ txid: "a", sats: 9999 }), "2026-07-01", redis);

    expect(second).toBe("duplicate");
    expect(await readVoteLedger("henry", redis)).toEqual([entry]);
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

describe("appendFoundingVote", () => {
  it("records a founding vote once, as an up-vote of the upload cost", async () => {
    const { redis } = fakeRedis();
    const res = await appendFoundingVote("alice",
      { inscriptionTxid: "insc1", postId: "p1", uploadCostSats: 14_000_000, inscriptionDay: "2026-07-01" }, "2026-07-10", redis);
    expect(res).toBe("recorded");
    const ledger = await readVoteLedger("alice", redis);
    expect(ledger).toEqual([{ txid: "insc1:p1", postId: "p1", dir: "up", sats: 14_000_000, day: "2026-07-01" }]);
  });

  it("rejects a second founding vote for the same post, even with a new txid", async () => {
    const { redis } = fakeRedis();
    await appendFoundingVote("alice", { inscriptionTxid: "insc1", postId: "p1", uploadCostSats: 100, inscriptionDay: "2026-07-01" }, "2026-07-10", redis);
    const res = await appendFoundingVote("alice", { inscriptionTxid: "insc2", postId: "p1", uploadCostSats: 999, inscriptionDay: "2026-07-02" }, "2026-07-10", redis);
    expect(res).toBe("duplicate");
    expect((await readVoteLedger("alice", redis)).length).toBe(1);
  });

  it("records founding votes for two posts sharing one inscription txid (no txid-gate collision)", async () => {
    const r = fakeRedis();
    const a = await appendFoundingVote("alice", { inscriptionTxid: "T", postId: "p1", uploadCostSats: 100, inscriptionDay: "2026-07-08" }, "2026-07-10", r.redis);
    const b = await appendFoundingVote("alice", { inscriptionTxid: "T", postId: "p2", uploadCostSats: 100, inscriptionDay: "2026-07-08" }, "2026-07-10", r.redis);
    expect(a).toBe("recorded");
    expect(b).toBe("recorded");                         // was "duplicate" before the fix
    expect((await readVoteLedger("alice", r.redis)).length).toBe(2);
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

describe("readScores", () => {
  it("folds the requested window on read, default week", async () => {
    const { redis: r } = fakeRedis();
    await appendVote("bob", { txid: "old", postId: "p1", dir: "up", sats: 500, day: "2026-06-01" }, "2026-07-10", r);
    await appendVote("bob", { txid: "new", postId: "p1", dir: "up", sats: 900, day: "2026-07-09" }, "2026-07-10", r);
    expect(await readScores("bob", "week", "2026-07-10", r)).toEqual({ p1: 900 });   // old is >7d out
    expect(await readScores("bob", "all",  "2026-07-10", r)).toEqual({ p1: 1400 });  // both
  });
});
