import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import {
  DEFAULT_HEAD_BUDGET_USD,
  HEAD_RESOURCES,
  headBudgetUsd,
  headSpendKey,
  releaseHeadRead,
  reserveHeadRead,
} from "./xHeadSpend";
import { spendKey } from "./xSpend";

/**
 * A fake Redis that models the two behaviours the real one has and that the
 * code under test depends on: a missing key counts as zero, and DECRBY may go
 * negative. Getting the second one wrong would hide the only way this system
 * can spend more than its budget.
 */
function fakeRedis() {
  const store = new Map<string, number>();
  const expiries = new Map<string, number>();
  return {
    store,
    expiries,
    redis: {
      incrby: async (key: string, by: number) => {
        const next = (store.get(key) ?? 0) + by;
        store.set(key, next);
        return next;
      },
      decrby: async (key: string, by: number) => {
        const next = (store.get(key) ?? 0) - by;
        store.set(key, next);
        return next;
      },
      expire: async (key: string, seconds: number) => {
        expiries.set(key, seconds);
        return 1;
      },
    } as unknown as Redis,
  };
}

const NOON = new Date("2026-07-30T12:00:00Z");

describe("headSpendKey — its own bucket, separate from the paid ceiling", () => {
  it("is a DIFFERENT key from the paid spend key on the same day", () => {
    // The whole point. If these shared a bucket, anonymous price discovery
    // would eat the budget paying customers depend on.
    expect(headSpendKey(NOON)).not.toBe(spendKey(NOON));
  });

  it("buckets by UTC day, like the paid key", () => {
    expect(headSpendKey(new Date("2026-07-08T23:59:59Z"))).toContain("2026-07-08");
    expect(headSpendKey(new Date("2026-07-09T00:00:01Z"))).toContain("2026-07-09");
  });
});

describe("headBudgetUsd", () => {
  it("falls back to the default when unset", () => {
    expect(headBudgetUsd({})).toBe(DEFAULT_HEAD_BUDGET_USD);
  });

  it("falls back when the value is not a number, rather than reading NaN as zero", () => {
    // A NaN budget read as 0 would refuse every quote; read as Infinity it
    // would refuse none. Neither is acceptable, so it must fall back.
    expect(headBudgetUsd({ X_API_HEAD_BUDGET_USD: "not-a-number" })).toBe(DEFAULT_HEAD_BUDGET_USD);
  });

  it("treats a BLANK value as unset, not as a zero budget", () => {
    // The likeliest misconfiguration is a deployment variable that exists but
    // holds nothing. Number("") and Number(" ") are both 0, so coercing first
    // would turn a blank setting into "refuse every quote" — the feature
    // silently off, looking configured. Whitespace counts as blank: an earlier
    // draft of this guard compared against "" only and let " " through as 0.
    expect(headBudgetUsd({ X_API_HEAD_BUDGET_USD: "" })).toBe(DEFAULT_HEAD_BUDGET_USD);
    expect(headBudgetUsd({ X_API_HEAD_BUDGET_USD: " " })).toBe(DEFAULT_HEAD_BUDGET_USD);
    expect(headBudgetUsd({ X_API_HEAD_BUDGET_USD: "\t\n" })).toBe(DEFAULT_HEAD_BUDGET_USD);
  });

  it("still reads a padded number, so a stray space in a deployment setting works", () => {
    expect(headBudgetUsd({ X_API_HEAD_BUDGET_USD: " 1.5 " })).toBe(1.5);
  });

  it("honours an explicit override, including zero", () => {
    expect(headBudgetUsd({ X_API_HEAD_BUDGET_USD: "1.25" })).toBe(1.25);
    expect(headBudgetUsd({ X_API_HEAD_BUDGET_USD: "0" })).toBe(0);
  });

  it("refuses a negative budget, which would otherwise read as a ceiling below zero", () => {
    expect(headBudgetUsd({ X_API_HEAD_BUDGET_USD: "-5" })).toBe(DEFAULT_HEAD_BUDGET_USD);
  });

  it("is smaller than the paid daily budget by default — abuse must not be able to spend the customers' half", () => {
    expect(DEFAULT_HEAD_BUDGET_USD).toBeLessThan(2);
  });
});

describe("reserveHeadRead", () => {
  it("books exactly one resource against the head bucket, and nothing against the paid one", async () => {
    const { redis, store } = fakeRedis();
    const r = await reserveHeadRead(NOON, redis);
    expect(r.ok).toBe(true);
    // Positive assertion: the counter really moved. A test that only checked
    // `ok` would pass against a no-op.
    expect(store.get(headSpendKey(NOON))).toBe(5); // one resource = $0.005 = 5 mils
    expect(store.get(spendKey(NOON))).toBeUndefined();
  });

  it("sets an expiry on the first reservation of a fresh day, so the bucket cannot outlive its day", async () => {
    const { redis, expiries } = fakeRedis();
    await reserveHeadRead(NOON, redis);
    expect(expiries.get(headSpendKey(NOON))).toBeGreaterThan(0);
  });

  it("does not re-set the expiry on later reservations, so a steady stream cannot hold the key alive", async () => {
    const { redis, expiries } = fakeRedis();
    await reserveHeadRead(NOON, redis);
    expiries.delete(headSpendKey(NOON));
    await reserveHeadRead(NOON, redis);
    expect(expiries.has(headSpendKey(NOON))).toBe(false);
  });

  it("refuses once the head budget is gone, and HANDS THE OVER-BUDGET RESERVATION BACK", async () => {
    const { redis, store } = fakeRedis();
    // A 0.02 budget is 20 mils = exactly four one-resource reads.
    const budget = 0.02;
    for (let i = 0; i < 4; i++) {
      expect((await reserveHeadRead(NOON, redis, budget)).ok).toBe(true);
    }
    const refused = await reserveHeadRead(NOON, redis, budget);
    expect(refused).toEqual({ ok: false, reason: "budget-exhausted" });
    // The refused attempt must not leave its own mils behind, or the bucket
    // would creep upward on every rejected request.
    expect(store.get(headSpendKey(NOON))).toBe(20);
  });

  it("FAILS CLOSED when there is no store — we never spend money we cannot count", async () => {
    expect(await reserveHeadRead(NOON, null)).toEqual({
      ok: false,
      reason: "accounting-unavailable",
    });
  });

  it("a zero budget refuses the very first read", async () => {
    const { redis } = fakeRedis();
    expect((await reserveHeadRead(NOON, redis, 0)).ok).toBe(false);
  });
});

describe("releaseHeadRead", () => {
  it("gives back exactly what a reservation took, leaving the bucket where it started", async () => {
    const { redis, store } = fakeRedis();
    await reserveHeadRead(NOON, redis);
    await releaseHeadRead(NOON, redis);
    expect(store.get(headSpendKey(NOON))).toBe(0);
  });

  it("releases against the SAME day it is given, so a reserve/release pair cannot straddle midnight", async () => {
    const { redis, store } = fakeRedis();
    const beforeMidnight = new Date("2026-07-30T23:59:59.900Z");
    await reserveHeadRead(beforeMidnight, redis);
    // The caller passes the reservation's own moment, not "now" — which is what
    // stops the release landing in tomorrow's bucket and creating it negative.
    await releaseHeadRead(beforeMidnight, redis);
    expect(store.get(headSpendKey(beforeMidnight))).toBe(0);
    expect(store.get(headSpendKey(new Date("2026-07-31T00:00:00Z")))).toBeUndefined();
  });

  it("is a silent no-op without a store, so a missing release can never throw into a route", async () => {
    await expect(releaseHeadRead(NOON, null)).resolves.toBeUndefined();
  });

  it("never drives the bucket below zero — a negative bucket is a ceiling LARGER than the budget", async () => {
    // releaseXApiSpend has no such floor, and that is the one path in this
    // system to spending more than the configured budget. This one is floored.
    const { redis, store } = fakeRedis();
    await releaseHeadRead(NOON, redis);
    await releaseHeadRead(NOON, redis);
    expect(store.get(headSpendKey(NOON)) ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe("HEAD_RESOURCES", () => {
  it("is one — a profile head returns exactly one resource, and X bills per resource returned", () => {
    expect(HEAD_RESOURCES).toBe(1);
  });
});
