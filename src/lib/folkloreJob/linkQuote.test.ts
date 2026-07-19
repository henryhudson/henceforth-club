import { describe, expect, it } from "vitest";
import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { LINK_FLOOR_PENCE, quoteLink, quoteLinkSats } from "./linkQuote";

/** The same hand-read rate the archive quote's tests inject. */
const RATE = 10.76375;

/** Mirror of the implementation's own conversion — ten pence of satoshis,
 * rounded up, at the given pounds-per-coin rate. */
const floorSatsAt = (rate: number) => Math.ceil((100_000_000 * (LINK_FLOOR_PENCE / 100)) / rate);

function quoted(result: ReturnType<typeof quoteLink>) {
  if (result === null) throw new Error("expected a quote, got null");
  return result;
}

describe("quoteLink — the inscription fee plus the ten-pence floor, at the live rate", () => {
  it("the floor dominates a tiny record: the fee is pennies, the floor is ten pence", () => {
    const recordBytes = 180; // a short link record
    const q = quoted(quoteLink(recordBytes, RATE));
    expect(q.premiumSats).toBe(floorSatsAt(RATE));
    expect(q.premiumSats).toBeGreaterThan(q.feeSats * 100);
    expect(q.priceSats).toBe(q.feeSats + q.premiumSats);
  });

  it("delegates the fee half to estimateSingleOpReturn — never a second formula", () => {
    for (const bytes of [64, 180, 4_096, 10_000]) {
      const q = quoted(quoteLink(bytes, RATE));
      expect(q.feeSats).toBe(estimateSingleOpReturn(bytes).minerFeeSats);
    }
  });

  it("keeps a complete decomposition the worker spends by: fee + premium + float = price, float exactly zero", () => {
    const q = quoted(quoteLink(180, RATE));
    expect(q.feeSats + q.premiumSats + q.floatSats).toBe(q.priceSats);
    // No float leg: the worker derives price − fee − premium = 0, so a link
    // job never needs the float pool address — the floor is revenue.
    expect(q.floatSats).toBe(0);
  });

  it("a dearer coin means a smaller floor leg — the ten pence are the constant", () => {
    const cheap = quoted(quoteLink(180, 10));
    const dear = quoted(quoteLink(180, 100));
    expect(dear.premiumSats).toBeLessThan(cheap.premiumSats);
    expect(dear.premiumSats).toBe(100_000);
  });

  it("fails closed without a live rate: undefined, zero, negative and NaN all refuse", () => {
    for (const rate of [undefined, 0, -5, Number.NaN]) {
      expect(quoteLink(180, rate)).toBeNull();
      expect(quoteLinkSats(180, rate)).toBeNull();
    }
  });

  it("refuses when the ten-pence floor falls to dust — money is never taken for a leg the worker could not pay on-chain", () => {
    // Ten pence is 546 satoshis or fewer only above roughly £18,315 per coin;
    // £20,000 per coin gives a 500-satoshi floor, unambiguously dust.
    expect(quoteLink(180, 20_000)).toBeNull();
  });

  it("prices garbage byte counts as zero-byte records rather than emitting unrepresentable satoshis", () => {
    const q = quoted(quoteLink(Number.NaN, RATE));
    expect(q.feeSats).toBe(0);
    expect(q.priceSats).toBe(floorSatsAt(RATE));
  });

  it("quoteLinkSats is the same quote collapsed to its total", () => {
    expect(quoteLinkSats(180, RATE)).toBe(quoted(quoteLink(180, RATE)).priceSats);
  });
});
