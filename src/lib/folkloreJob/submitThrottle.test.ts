import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import {
  SUBMIT_QUOTES_PER_ADDRESS,
  SUBMIT_WINDOW_MINUTES,
  claimSubmitSlot,
  clientAddress,
  ipv6Prefix,
} from "./submitThrottle";
import { MAX_CONCURRENT_JOBS, RESERVED_ARCHIVE_JOBS } from "./constants";

const WINDOW_MS = SUBMIT_WINDOW_MINUTES * 60_000;

/** Only the three calls the throttle makes, with expiries honoured against a
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
    get: async (key: string) => live(key)?.value ?? null,
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

  it("bounds any two adjacent windows, so a boundary cannot be straddled", async () => {
    // The defect this replaces a false claim about. A single fixed window let
    // one bucket spend its whole allowance at the end of a window and its
    // whole allowance again at the start of the next, holding twice the
    // allowance at once for as long as an unpaid job keeps its slot — which
    // is exactly the window's length. Summing the current and previous
    // counters bounds the pair, and therefore any instant.
    const clock = { now: 1_000_000 };
    const redis = fakeRedis(clock);
    // Spend the whole allowance at the very end of a window.
    clock.now = 2 * WINDOW_MS - 1;
    for (let i = 0; i < SUBMIT_QUOTES_PER_ADDRESS; i += 1) {
      expect(await claimSubmitSlot("10.0.0.1", clock.now, redis)).toEqual({ kind: "allowed" });
    }

    // One millisecond later the window has turned. The old counter has not.
    clock.now = 2 * WINDOW_MS;
    expect((await claimSubmitSlot("10.0.0.1", clock.now, redis)).kind).toBe("throttled");
  });

  it("never claims more of the shared pipeline than it holds back", async () => {
    // What this module honestly bounds is ONE bucket, and the allowance is
    // under the ceiling — but two buckets exhaust that ceiling exactly, which
    // is why the guarantee that a free submit cannot take the last slot lives
    // in jobStore's reservation, asserted there, and not in this arithmetic.
    expect(SUBMIT_QUOTES_PER_ADDRESS).toBeLessThan(MAX_CONCURRENT_JOBS);
    expect(SUBMIT_QUOTES_PER_ADDRESS).toBeLessThanOrEqual(
      MAX_CONCURRENT_JOBS - RESERVED_ARCHIVE_JOBS,
    );
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

  it("reports a retry time that is really when the allowance returns", async () => {
    // Not simply the next window boundary: this window's count becomes next
    // window's carry, so a bucket that has spent the whole allowance is still
    // refused there. Sending a well-behaved client back to be refused again
    // would be the same kind of overstatement this module's comments used to
    // make — so the answer is honest, and the test walks the clock to it.
    const clock = { now: 1_000_000 };
    const redis = fakeRedis(clock);
    for (let i = 0; i < SUBMIT_QUOTES_PER_ADDRESS; i += 1) {
      await claimSubmitSlot("10.0.0.1", clock.now, redis);
    }
    const refused = await claimSubmitSlot("10.0.0.1", clock.now, redis);
    if (refused.kind !== "throttled") throw new Error("expected a throttled slot");

    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual((2 * WINDOW_MS) / 1000);

    // A moment before the stated time: still refused, as promised.
    clock.now += refused.retryAfterSeconds * 1000 - 2_000;
    expect((await claimSubmitSlot("10.0.0.1", clock.now, redis)).kind).toBe("throttled");
  });

  it("restores the allowance once the spent windows have rolled off", async () => {
    const clock = { now: 1_000_000 };
    const redis = fakeRedis(clock);
    for (let i = 0; i < SUBMIT_QUOTES_PER_ADDRESS + 1; i += 1) {
      await claimSubmitSlot("10.0.0.1", clock.now, redis);
    }
    expect((await claimSubmitSlot("10.0.0.1", clock.now, redis)).kind).toBe("throttled");

    clock.now += 2 * WINDOW_MS;
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

  it("keys IPv6 on the routed /64 — one customer is one bucket", () => {
    // The hole: a /64 is the smallest block a provider hands one customer, so
    // keying the full address gave a single connection an effectively
    // unlimited supply of buckets and the allowance bounded nothing.
    const bucket = (address: string) =>
      clientAddress(new Request("http://x/", { headers: { "x-forwarded-for": address } }));

    const first = bucket("2001:db8:abcd:1234:1:2:3:4");
    expect(first).toBe("2001:db8:abcd:1234::/64");
    expect(bucket("2001:db8:abcd:1234:ffff:ffff:ffff:ffff")).toBe(first);
    // A different /64 is a different customer and keeps its own allowance.
    expect(bucket("2001:db8:abcd:1235::1")).not.toBe(first);
  });
});

describe("ipv6Prefix — one prefix cannot be spelled two ways", () => {
  it("expands compression, strips zone id and brackets, and normalises case", () => {
    for (const spelling of [
      "2001:0db8:0000:0000:0000:0000:0000:0001",
      "2001:db8::1",
      "2001:DB8::1",
      "[2001:db8::1]",
      "2001:db8::1%eth0",
    ]) {
      expect(ipv6Prefix(spelling)).toBe("2001:db8:0:0::/64");
    }
  });

  it("handles the all-zero address and a compression that fills one hextet", () => {
    expect(ipv6Prefix("::")).toBe("0:0:0:0::/64");
    expect(ipv6Prefix("1:2:3:4:5:6:7::")).toBe("1:2:3:4::/64");
  });

  it("returns null for anything not a plain IPv6 address — keyed whole, never looser", () => {
    for (const notIpv6 of [
      "203.0.113.7",
      "unknown",
      "::ffff:192.0.2.1", // IPv4-mapped: the v4 address is the real identity
      "2001:db8::1::2", // two compressions
      "2001:db8:1:2:3:4:5", // too few, uncompressed
      "2001:db8:zzzz::1",
      "",
    ]) {
      expect(ipv6Prefix(notIpv6)).toBeNull();
    }
  });
});
