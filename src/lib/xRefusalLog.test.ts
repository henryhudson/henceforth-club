import { describe, it, expect } from "vitest";
import type { Redis } from "@upstash/redis";
import { logRefusal, readRefusals, REFUSAL_CAP, type RegisterRefusal } from "./xRefusalLog";

function refusal(overrides: Partial<RegisterRefusal> = {}): RegisterRefusal {
  return {
    at: 1753300000,
    handle: "henryhudson6",
    txid: "a".repeat(64),
    reason: "no-archive-in-tx",
    status: 422,
    ...overrides,
  };
}

/** A minimal in-memory stand-in for the Upstash client — only the calls
 * xRefusalLog actually makes: `lpush`, `ltrim`, `lrange`. */
function fakeRedis(): { redis: Redis; lists: Map<string, unknown[]> } {
  const lists = new Map<string, unknown[]>();
  const redis = {
    lpush: async (key: string, ...elements: unknown[]) => {
      const list = lists.get(key) ?? [];
      for (const e of elements) list.unshift(e);
      lists.set(key, list);
      return list.length;
    },
    ltrim: async (key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      lists.set(key, list.slice(start, stop + 1));
      return "OK";
    },
    lrange: async <T,>(key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      return (stop === -1 ? list.slice(start) : list.slice(start, stop + 1)) as T[];
    },
  } as unknown as Redis;
  return { redis, lists };
}

/** A client whose every call fails — Redis configured but down. */
function brokenRedis(): Redis {
  const boom = async () => { throw new Error("redis down"); };
  return { lpush: boom, ltrim: boom, lrange: boom } as unknown as Redis;
}

describe("logRefusal", () => {
  it("keeps the record exactly as given, newest first", async () => {
    const { redis } = fakeRedis();
    const first = refusal({ reason: "bad-input", status: 400 });
    const second = refusal({ reason: "x-unreachable", status: 503 });

    expect(await logRefusal(first, redis)).toBe(true);
    expect(await logRefusal(second, redis)).toBe(true);

    expect(await readRefusals(50, redis)).toEqual([second, first]);
  });

  it("caps the list: the oldest refusal falls off, never the newest", async () => {
    const { redis, lists } = fakeRedis();
    for (let i = 0; i < REFUSAL_CAP + 3; i++) {
      await logRefusal(refusal({ at: i }), redis);
    }
    const kept = lists.get("x:register:refusals") as RegisterRefusal[];
    expect(kept).toHaveLength(REFUSAL_CAP);
    expect(kept[0].at).toBe(REFUSAL_CAP + 2); // newest kept
    expect(kept[kept.length - 1].at).toBe(3); // 0, 1, 2 dropped
  });

  it("never throws when Redis is down — the route's answer must not change", async () => {
    await expect(logRefusal(refusal(), brokenRedis())).resolves.toBe(false);
  });

  it("is a no-op when Redis is unconfigured", async () => {
    expect(await logRefusal(refusal(), null)).toBe(false);
  });
});

describe("readRefusals", () => {
  it("returns only the newest `count`", async () => {
    const { redis } = fakeRedis();
    for (let i = 0; i < 5; i++) await logRefusal(refusal({ at: i }), redis);
    expect((await readRefusals(2, redis)).map((r) => r.at)).toEqual([4, 3]);
  });

  it("is empty when Redis is unconfigured or down", async () => {
    expect(await readRefusals(50, null)).toEqual([]);
    expect(await readRefusals(50, brokenRedis())).toEqual([]);
  });
});
