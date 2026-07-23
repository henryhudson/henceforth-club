import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Redis } from "@upstash/redis";

// `current` stands in for the module-level cached client `getRedis()` would
// otherwise return. Null by default, matching the real function when no
// Upstash env vars are set — tests that want a working store assign
// `current = fakeRedis()` themselves.
let current: Redis | null = null;
vi.mock("./redis", () => ({ getRedis: () => current }));

import { listHandles, readHandleCards, setXTxids, stampHandle } from "./xIndex";

/** Every `zmscore` the fake was asked for, so a test can assert that a
 * look-up with nothing to look up costs no round trip at all. */
let zmscoreCalls: string[][] = [];

/** A minimal in-memory stand-in for the Upstash client — only the calls
 * xIndex actually makes: `zadd` (with `gt`), `zrange` (with `rev` +
 * `withScores`, returned flat as Upstash does: member, score, member, score…)
 * and `zmscore`, which answers null for a member the set does not hold. */
function fakeRedis(): Redis {
  const zsets = new Map<string, Map<string, number>>();
  return {
    zmscore: async (key: string, members: string[]) => {
      zmscoreCalls.push(members);
      const zset = zsets.get(key) ?? new Map<string, number>();
      return members.map((member) => zset.get(member) ?? null);
    },
    zadd: async (key: string, opts: { gt?: boolean }, ...pairs: Array<{ score: number; member: string }>) => {
      const zset = zsets.get(key) ?? new Map<string, number>();
      for (const { score, member } of pairs) {
        const existing = zset.get(member);
        if (opts?.gt && existing !== undefined && score <= existing) continue;
        zset.set(member, score);
      }
      zsets.set(key, zset);
      return pairs.length;
    },
    zrange: async (key: string, start: number, stop: number, opts?: { rev?: boolean; withScores?: boolean }) => {
      const zset = zsets.get(key) ?? new Map<string, number>();
      let entries = [...zset.entries()].sort((a, b) => a[1] - b[1]);
      if (opts?.rev) entries = entries.reverse();
      const sliced = stop === -1 ? entries.slice(start) : entries.slice(start, stop + 1);
      return opts?.withScores ? sliced.flatMap(([member, score]) => [member, score]) : sliced.map(([member]) => member);
    },
  } as unknown as Redis;
}

beforeEach(() => {
  current = null;
  zmscoreCalls = [];
});

describe("setXTxids", () => {
  it("returns false when Redis is unconfigured, never throwing", async () => {
    // No KV_REST_API_URL in the test environment -> getRedis() is null.
    await expect(setXTxids("henryhudson6", ["a".repeat(64)])).resolves.toBe(false);
  });
});

describe("stampHandle", () => {
  it("records the latest registration time in x:handles", async () => {
    current = fakeRedis();
    await expect(stampHandle("HenryHudson6", 1000)).resolves.toBe(true);
    expect(await listHandles()).toEqual([{ handle: "henryhudson6", latestMs: 1000 }]);
  });

  it("is idempotent upward — an older second stamp never lowers the score", async () => {
    current = fakeRedis();
    await stampHandle("henryhudson6", 2000);
    await stampHandle("henryhudson6", 1000);
    expect(await listHandles()).toEqual([{ handle: "henryhudson6", latestMs: 2000 }]);
  });

  it("a later second stamp does raise the score", async () => {
    current = fakeRedis();
    await stampHandle("henryhudson6", 1000);
    await stampHandle("henryhudson6", 2000);
    expect(await listHandles()).toEqual([{ handle: "henryhudson6", latestMs: 2000 }]);
  });

  it("returns false when Redis is unconfigured, never throwing", async () => {
    await expect(stampHandle("henryhudson6", 1000)).resolves.toBe(false);
  });
});

describe("listHandles", () => {
  it("returns newest-stamped handle first", async () => {
    current = fakeRedis();
    await stampHandle("alice", 1000);
    await stampHandle("bob", 2000);
    expect(await listHandles()).toEqual([
      { handle: "bob", latestMs: 2000 },
      { handle: "alice", latestMs: 1000 },
    ]);
  });

  it("tolerates missing Redis, returning an empty list rather than throwing", async () => {
    await expect(listHandles()).resolves.toEqual([]);
  });
});

describe("readHandleCards", () => {
  it("reads the cards for named handles, whatever the directory window held", async () => {
    current = fakeRedis();
    await stampHandle("zed", 1_000);
    await stampHandle("newcomer", 10_000);
    expect(await readHandleCards(["zed"])).toEqual([{ handle: "zed", latestMs: 1_000 }]);
  });

  it("is case-blind, and answers in the order it was asked", async () => {
    current = fakeRedis();
    await stampHandle("ada", 1_000);
    await stampHandle("zed", 2_000);
    expect(await readHandleCards(["ZED", "Ada"])).toEqual([
      { handle: "zed", latestMs: 2_000 },
      { handle: "ada", latestMs: 1_000 },
    ]);
  });

  it("drops a handle the directory never registered — no card, no row", async () => {
    current = fakeRedis();
    await stampHandle("ada", 1_000);
    expect(await readHandleCards(["ada", "ghost"])).toEqual([{ handle: "ada", latestMs: 1_000 }]);
  });

  it("costs no round trip when there is nothing to look up", async () => {
    current = fakeRedis();
    expect(await readHandleCards([])).toEqual([]);
    expect(zmscoreCalls).toEqual([]);
  });

  it("tolerates missing Redis, returning an empty list rather than throwing", async () => {
    await expect(readHandleCards(["ada"])).resolves.toEqual([]);
  });
});
