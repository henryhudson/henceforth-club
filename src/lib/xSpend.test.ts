import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAILY_BUDGET_USD,
  USD_PER_RESOURCE,
  dailyBudgetUsd,
  resourcesToUsd,
  spendKey,
  usdToMils,
  withinBudget,
} from "./xSpend";

describe("resourcesToUsd", () => {
  it("prices a resource at what X charges for one", () => {
    expect(USD_PER_RESOURCE).toBe(0.005);
    expect(resourcesToUsd(1)).toBeCloseTo(0.005);
  });

  it("prices one page of posts at fifty cents", () => {
    expect(resourcesToUsd(100)).toBeCloseTo(0.5);
  });

  it("prices the whole 3,200-post timeline at sixteen dollars — the loss this cap exists to prevent", () => {
    expect(resourcesToUsd(3200)).toBeCloseTo(16);
  });

  it("never charges for negative resources", () => {
    expect(resourcesToUsd(-5)).toBe(0);
  });
});

describe("usdToMils", () => {
  it("rounds up, so we never under-account our own spend", () => {
    expect(usdToMils(0.0001)).toBe(1);
    expect(usdToMils(0.505)).toBe(505);
  });
});

describe("withinBudget", () => {
  it("allows spend up to and including the budget", () => {
    expect(withinBudget(usdToMils(2), 2)).toBe(true);
  });

  it("refuses a single mil over", () => {
    expect(withinBudget(usdToMils(2) + 1, 2)).toBe(false);
  });

  it("a zero budget refuses everything but zero", () => {
    expect(withinBudget(1, 0)).toBe(false);
    expect(withinBudget(0, 0)).toBe(true);
  });
});

describe("dailyBudgetUsd", () => {
  it("reads the environment", () => {
    expect(dailyBudgetUsd({ X_API_DAILY_BUDGET_USD: "7.5" })).toBe(7.5);
  });

  it("falls back to the default when unset, non-numeric, or negative", () => {
    expect(dailyBudgetUsd({})).toBe(DEFAULT_DAILY_BUDGET_USD);
    expect(dailyBudgetUsd({ X_API_DAILY_BUDGET_USD: "lots" })).toBe(DEFAULT_DAILY_BUDGET_USD);
    expect(dailyBudgetUsd({ X_API_DAILY_BUDGET_USD: "-1" })).toBe(DEFAULT_DAILY_BUDGET_USD);
  });

  it("honours an explicit zero — a way to switch the endpoints off", () => {
    expect(dailyBudgetUsd({ X_API_DAILY_BUDGET_USD: "0" })).toBe(0);
  });
});

describe("spendKey", () => {
  it("buckets by UTC day, so a budget cannot be doubled by a timezone", () => {
    expect(spendKey(new Date("2026-07-08T23:59:59Z"))).toBe("xapi:spend:2026-07-08");
    expect(spendKey(new Date("2026-07-09T00:00:01Z"))).toBe("xapi:spend:2026-07-09");
  });
});
