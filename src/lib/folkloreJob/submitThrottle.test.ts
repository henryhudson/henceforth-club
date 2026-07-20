import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import {
  SUBMIT_QUOTES_PER_ADDRESS,
  SUBMIT_WINDOW_MINUTES,
  claimSubmitSlot,
  clientAddress,
} from "./submitThrottle";
import { MAX_CONCURRENT_JOBS } from "./constants";

const WINDOW_MS = SUBMIT_WINDOW_MINUTES * 60_000;

/** Only the two calls the throttle makes, with expiries honoured against a
 * settable clock so a window boundary can be crossed without waiting. */
function fakeRedis(clock: { now: number }): Redis {
  const counters = new Map<string, { value: number; expiresAt: number }>();
  const live = (key: string) => {
    const entry = counters.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== Infinity && clock.now >= entry.expiresAt) {
      counters.delete(key);
      return null;
    }
    return entry;
  };
  return {
    incr: async (key: string) => {
      const entry = live(key);
      if (entry) {
        entry.value += 1;
        return entry.value;
      }
      counters.set(key, { value: 1, expiresAt: Infinity });
      return 1;
    },
    expire: async (key: string, seconds: number) => {
      const entry = live(key);
      if (!entry) return 0;
      entry.expiresAt = clock.now + seconds * 1000;
      return 1;
    },
  } as unknown as Redis;
}

describe("the allowance bounds what one address can hold", () => {
  it("allows exactly SUBMIT_QUOTES_PER_ADDRESS jobs in a window, then refuses", async () => {
    const clock = { now: 1_000_000 };
    const redis = fakeRedis(clock);

    for (let i = 0; i < SUBMIT_QUOTES_PER_ADDRESS; i += 1) {
      expect(await claimSubmitSlot("10.0.0.1", clock.now, redis)).toEqual({ kind: "allowed" });
    }
    const refused = await claimSubmitSlot("10.0.0.1", clock.now, redis);
    expect(refused.kind).toBe("throttled");
  });

  it("leaves a majority of the shared pipeline for everyone else", async () => {
    // The property that makes a free flood harmless to a paid submission:
    // one address can never reach the concurrent-job ceiling on its own.
    expect(SUBMIT_QUOTES_PER_ADDRESS).toBeLessThan(MAX_CONCURRENT_JOBS);
    expect(SUBMIT_QUOTES_PER_ADDRESS * 2).toBeLessThanOrEqual(MAX_CONCURRENT_JOBS);
  });

  it("throttles per address — one flooder never spends another's allowance", async () => {
    const clock = { now: 1_000_000 };
    const redis = fakeRedis(clock);

    for (let i = 0; i < 10; i += 1) await claimSubmitSlot("10.0.0.1", clock.now, redis);

    expect(await claimSubmitSlot("10.0.0.2", clock.now, redis)).toEqual({ kind: "allowed" });
  });

  it("counts refused attempts too — hammering pins the window, never resets it", async () => {
    const clock = { now: 1_000_000 };
    const redis = fakeRedis(clock);

    for (let i = 0; i < 50; i += 1) await claimSubmitSlot("10.0.0.1", clock.now, redis);

    // Still refused a moment later within the same window.
    const again = await claimSubmitSlot("10.0.0.1", clock.now + 1_000, redis);
    expect(again.kind).toBe("throttled");
  });

  it("reports how long until the allowance returns, never past the window", async () => {
    const clock = { now: 1_000_000 };
    const redis = fakeRedis(clock);
    for (let i = 0; i < SUBMIT_QUOTES_PER_ADDRESS + 1; i += 1) {
      await claimSubmitSlot("10.0.0.1", clock.now, redis);
    }
    const refused = await claimSubmitSlot("10.0.0.1", clock.now, redis);
    if (refused.kind !== "throttled") throw new Error("expected a throttled slot");

    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_MS / 1000);
  });

  it("restores the allowance in the next window", async () => {
    const clock = { now: 1_000_000 };
    const redis = fakeRedis(clock);
    for (let i = 0; i < SUBMIT_QUOTES_PER_ADDRESS + 1; i += 1) {
      await claimSubmitSlot("10.0.0.1", clock.now, redis);
    }
    expect((await claimSubmitSlot("10.0.0.1", clock.now, redis)).kind).toBe("throttled");

    clock.now += WINDOW_MS;
    expect(await claimSubmitSlot("10.0.0.1", clock.now, redis)).toEqual({ kind: "allowed" });
  });

  it("is open without a store — the throttle never reports someone else's outage", async () => {
    expect(await claimSubmitSlot("10.0.0.1", 1_000_000, null)).toEqual({ kind: "allowed" });
  });
});

describe("clientAddress", () => {
  it("takes the left-most forwarded entry — the client as the edge saw it", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" },
    });
    expect(clientAddress(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to one shared bucket", () => {
    expect(clientAddress(new Request("http://x/", { headers: { "x-real-ip": "198.51.100.9" } }))).toBe(
      "198.51.100.9",
    );
    // Unattributable requests share an allowance rather than escaping it.
    expect(clientAddress(new Request("http://x/"))).toBe("unknown");
  });
});
