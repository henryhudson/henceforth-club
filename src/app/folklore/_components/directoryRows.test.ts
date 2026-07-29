import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Redis } from "@upstash/redis";

// Same seam the xIndex tests use: `current` stands in for the module-level
// client `getRedis()` returns, null by default as it is with no Upstash env.
let current: Redis | null = null;
vi.mock("@/lib/redis", () => ({ getRedis: () => current }));

import { readDirectoryRows } from "./directoryRows";

/** Every `mget` the fake served, so a test can count round trips rather than
 * trust that batching happened. */
let mgetCalls: string[][] = [];

/** A minimal in-memory store — the only call these four readers make is
 * `mget`, which answers null for a key it does not hold. */
function fakeRedis(entries: Record<string, unknown>): Redis {
  return {
    mget: async (...keys: string[]) => {
      mgetCalls.push(keys);
      return keys.map((k) => entries[k] ?? null);
    },
  } as unknown as Redis;
}

beforeEach(() => {
  mgetCalls = [];
  current = null;
});

const meta = (postCount: number) => ({ v: 3, postCount });

describe("readDirectoryRows", () => {
  it("reads a whole board in a fixed number of round trips, not four per row", async () => {
    const handles = Array.from({ length: 50 }, (_, i) => `handle${i}`);
    current = fakeRedis(
      Object.fromEntries(
        handles.flatMap((h, i) => [
          [`x:${h}`, [`tx${i}`]],
          [`x:posts:${h}:meta`, meta(i + 1)],
        ]),
      ),
    );

    const rows = await readDirectoryRows(handles);

    expect(rows.size).toBe(50);
    expect(rows.get("handle7")).toEqual({ latestTxid: "tx7", verified: false, postCount: 8 });
    // Three batched reads; the digest pass is skipped entirely because every
    // handle already had a cached count. Under the old per-row shape this was
    // 200 sequential reads.
    expect(mgetCalls).toHaveLength(3);
  });

  it("prefers the cached archive total over the latest transaction's digest", async () => {
    // The 2026-07-16 bug: a 1,672-post archive whose newest delta carried two
    // posts rendered as "2 posts". The cached total is the answer whenever it
    // exists, and a handle holding one is never even looked up in the digests.
    current = fakeRedis({
      "x:henry": ["txA", "txB"],
      "x:posts:henry:meta": meta(1672),
      "x:txdigest:txB": { tweetIds: ["1", "2"], mediaPostIds: [] },
    });

    const rows = await readDirectoryRows(["henry"]);

    expect(rows.get("henry")?.postCount).toBe(1672);
    expect(rows.get("henry")?.latestTxid).toBe("txB"); // newest delta, not the first
  });

  it("falls back to the digest count for a handle whose archive isn't cached yet", async () => {
    current = fakeRedis({
      "x:newcomer": ["txN"],
      "x:txdigest:txN": { tweetIds: ["1", "2", "3"], mediaPostIds: [] },
    });

    const rows = await readDirectoryRows(["newcomer"]);

    expect(rows.get("newcomer")?.postCount).toBe(3);
  });

  it("leaves the count absent — never zero — when nothing knows it", async () => {
    current = fakeRedis({ "x:quiet": ["txQ"] });

    const rows = await readDirectoryRows(["quiet"]);

    expect(rows.get("quiet")).toEqual({ latestTxid: "txQ", verified: false, postCount: undefined });
  });

  it("marks owner-verified handles and leaves the rest unverified", async () => {
    current = fakeRedis({
      "x:owned": ["tx1"],
      "x:owner:owned": { address: "1A", pubkey: "02", boundAt: 1, bindingTxid: "t", bindingPostId: "p" },
      "x:stranger": ["tx2"],
    });

    const rows = await readDirectoryRows(["owned", "stranger"]);

    expect(rows.get("owned")?.verified).toBe(true);
    expect(rows.get("stranger")?.verified).toBe(false);
  });

  it("costs nothing when there are no rows, and survives an unreachable store", async () => {
    expect((await readDirectoryRows([])).size).toBe(0);
    expect(mgetCalls).toHaveLength(0);

    current = null; // no Upstash configured
    const rows = await readDirectoryRows(["henry"]);
    expect(rows.get("henry")).toEqual({ latestTxid: null, verified: false, postCount: undefined });
  });
});
