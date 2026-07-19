import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import { readKudosReceived, recordKudosReceived, type ReceivedKudos } from "./received";

/** A minimal in-memory stand-in for the Upstash client — the received
 * stream is one `rpush` to write and one `lrange` to read. */
function fakeRedis(): Redis {
  const store = new Map<string, unknown[]>();
  return {
    rpush: async (key: string, ...values: unknown[]) => {
      const list = store.get(key) ?? [];
      list.push(...values);
      store.set(key, list);
      return list.length;
    },
    lrange: async (key: string, start: number, stop: number) => {
      const list = store.get(key) ?? [];
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    },
  } as unknown as Redis;
}

const DAY = "2026-07-18";

const received = (overrides: Partial<ReceivedKudos> = {}): ReceivedKudos => ({
  postId: "p1",
  author: "ann",
  amount: 5,
  kind: "tip",
  ...overrides,
});

describe("the day-keyed kudos-received stream", () => {
  it("appends and reads a day's entries in order — the chart's replayable input", async () => {
    const redis = fakeRedis();
    await recordKudosReceived(DAY, received({ kind: "duel", amount: 3 }), redis);
    await recordKudosReceived(DAY, received({ postId: "p2", amount: 7 }), redis);

    expect(await readKudosReceived(DAY, redis)).toEqual([
      { postId: "p1", author: "ann", amount: 3, kind: "duel" },
      { postId: "p2", author: "ann", amount: 7, kind: "tip" },
    ]);
  });

  it("holds the day boundary: an entry recorded under one day never reads under another", async () => {
    const redis = fakeRedis();
    await recordKudosReceived(DAY, received(), redis);

    expect(await readKudosReceived("2026-07-19", redis)).toEqual([]);
    expect(await readKudosReceived("2026-07-17", redis)).toEqual([]);
    expect(await readKudosReceived(DAY, redis)).toHaveLength(1);
  });

  it("reads an empty day as an empty list", async () => {
    expect(await readKudosReceived(DAY, fakeRedis())).toEqual([]);
  });

  it("is null-Redis safe: unavailable to write, empty to read", async () => {
    expect(await recordKudosReceived(DAY, received(), null)).toBe("unavailable");
    expect(await readKudosReceived(DAY, null)).toEqual([]);
  });
});
