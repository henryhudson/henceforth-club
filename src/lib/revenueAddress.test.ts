import { describe, expect, it } from "vitest";
import { REVENUE_ADDRESS as WORKER_REVENUE_ADDRESS } from "../../scripts/xtext-worker/worker.mjs";
import { REVENUE_ADDRESS, revenueSatsTo } from "./revenueAddress";

const OTHER = "1BitcoinEaterAddressDontSendf59kuE";

describe("REVENUE_ADDRESS", () => {
  it("is the one string the retired worker paid the premium to", () => {
    expect(REVENUE_ADDRESS).toBe(WORKER_REVENUE_ADDRESS);
    expect(REVENUE_ADDRESS).toBe("1GsP511T8e4VjxYdAGnMYdDd6sWxWybcMP");
  });
});

describe("revenueSatsTo", () => {
  it("sums every output paying the address, in satoshis", () => {
    const outputs = [
      { value: 0.0093, addresses: [REVENUE_ADDRESS] },
      { value: 0, addresses: [] },
      { value: 0.00000546, addresses: [REVENUE_ADDRESS] },
      { value: 1.5, addresses: [OTHER] },
    ];
    expect(revenueSatsTo(REVENUE_ADDRESS, outputs)).toBe(930_546);
  });

  it("is zero when nothing pays the address", () => {
    expect(revenueSatsTo(REVENUE_ADDRESS, [])).toBe(0);
    expect(revenueSatsTo(REVENUE_ADDRESS, [{ value: 2, addresses: [OTHER] }])).toBe(0);
  });

  it("rounds whole-coin values to the satoshi, never a fraction", () => {
    expect(
      revenueSatsTo(REVENUE_ADDRESS, [{ value: 0.1 + 0.2, addresses: [REVENUE_ADDRESS] }]),
    ).toBe(30_000_000);
  });

  it("pays nothing for an unreadable value", () => {
    expect(
      revenueSatsTo(REVENUE_ADDRESS, [{ value: Number.NaN, addresses: [REVENUE_ADDRESS] }]),
    ).toBe(0);
  });
});
