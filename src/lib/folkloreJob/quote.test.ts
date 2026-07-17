import { describe, expect, it } from "vitest";
import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { quoteArchive, type QuoteResult } from "./quote";

/** 2026-07-10's hand-read rate, now injected instead of frozen. */
const RATE = 10.76375;

function quoted(result: QuoteResult) {
  if (result.kind !== "quoted") throw new Error(`expected a quote, got ${result.kind}`);
  return result.quote;
}

describe("quoteArchive — a flat £1 at the live rate", () => {
  it("prices exactly one pound of satoshis, rounded up", () => {
    const q = quoted(quoteArchive(208731, RATE));
    expect(q.priceSats).toBe(Math.ceil(100_000_000 / RATE)); // 9,290,443
  });

  it("keeps the fee/premium decomposition the worker spends by: fee from the fixture-pinned estimator, premium the remainder", () => {
    const q = quoted(quoteArchive(208731, RATE));
    expect(q.feeSats).toBe(estimateSingleOpReturn(208731).minerFeeSats);
    expect(q.premiumSats).toBe(q.priceSats - q.feeSats);
    expect(q.feeSats + q.premiumSats).toBe(q.priceSats); // no satoshi invented or lost
  });

  it("a dearer coin means fewer satoshis — the pound is the constant", () => {
    const cheap = quoted(quoteArchive(1000, 10));
    const dear = quoted(quoteArchive(1000, 100));
    expect(dear.priceSats).toBeLessThan(cheap.priceSats);
    expect(dear.priceSats).toBe(1_000_000);
  });

  it("fails closed without a live rate: undefined, zero, negative and NaN all refuse", () => {
    for (const rate of [undefined, 0, -5, Number.NaN]) {
      expect(quoteArchive(1000, rate)).toEqual({ kind: "rate-unavailable" });
    }
  });

  it("refuses when the £1 no longer covers the miner fee plus dust — money is never taken for an uninscribable job", () => {
    // 1,000,000 archive bytes → ~100,024 sats fee. A rate above ~£994/coin
    // pushes £1 below fee + dust; use £2,000/coin to be unambiguous.
    expect(quoteArchive(1_000_000, 2000)).toEqual({ kind: "price-below-fee" });
  });

  it("prices garbage byte counts as zero-byte archives rather than emitting unrepresentable satoshis", () => {
    const q = quoted(quoteArchive(Number.NaN, RATE));
    expect(q.feeSats).toBe(0);
    expect(q.priceSats).toBe(Math.ceil(100_000_000 / RATE));
  });
});
