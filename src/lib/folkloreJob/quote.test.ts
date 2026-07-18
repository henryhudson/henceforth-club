import { describe, expect, it } from "vitest";
import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { FLOAT_POUNDS } from "@/lib/kudos/constants";
import { quoteArchive, type QuoteResult } from "./quote";

/** 2026-07-10's hand-read rate, now injected instead of frozen. */
const RATE = 10.76375;

const floatSatsAt = (rate: number) => Math.ceil((100_000_000 * FLOAT_POUNDS) / rate);

function quoted(result: QuoteResult) {
  if (result.kind !== "quoted") throw new Error(`expected a quote, got ${result.kind}`);
  return result.quote;
}

describe("quoteArchive — the inscription fee plus the £2 kudos float leg, at the live rate", () => {
  it("prices exactly fee plus two pounds of satoshis, the float leg rounded up", () => {
    const q = quoted(quoteArchive(208731, RATE));
    expect(q.floatSats).toBe(floatSatsAt(RATE));
    expect(q.feeSats).toBe(estimateSingleOpReturn(208731).minerFeeSats);
    expect(q.priceSats).toBe(q.feeSats + q.floatSats);
  });

  it("keeps a complete decomposition the worker spends by: fee + premium + float = price, no satoshi invented or lost", () => {
    const q = quoted(quoteArchive(208731, RATE));
    expect(q.feeSats + q.premiumSats + q.floatSats).toBe(q.priceSats);
  });

  it("carries no revenue premium — the £2 funds the buyer's kudos float, it is not income", () => {
    const q = quoted(quoteArchive(208731, RATE));
    expect(q.premiumSats).toBe(0);
  });

  it("a dearer coin means a smaller float leg — the two pounds are the constant", () => {
    const cheap = quoted(quoteArchive(1000, 10));
    const dear = quoted(quoteArchive(1000, 100));
    expect(dear.floatSats).toBeLessThan(cheap.floatSats);
    expect(dear.floatSats).toBe(2_000_000);
  });

  it("fails closed without a live rate: undefined, zero, negative and NaN all refuse", () => {
    for (const rate of [undefined, 0, -5, Number.NaN]) {
      expect(quoteArchive(1000, rate)).toEqual({ kind: "rate-unavailable" });
    }
  });

  it("refuses when the £2 float leg falls to dust — money is never taken for a float the worker could not pay on-chain", () => {
    // £2 is 546 satoshis or fewer only above roughly £366,300 per coin;
    // £400,000 per coin gives a 500-satoshi float leg, unambiguously dust.
    expect(quoteArchive(1000, 400_000)).toEqual({ kind: "price-below-fee" });
  });

  it("prices garbage byte counts as zero-byte archives rather than emitting unrepresentable satoshis", () => {
    const q = quoted(quoteArchive(Number.NaN, RATE));
    expect(q.feeSats).toBe(0);
    expect(q.priceSats).toBe(floatSatsAt(RATE));
  });
});
