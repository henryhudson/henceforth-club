import { describe, expect, it } from "vitest";
import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { WEB_PREMIUM_SATS } from "./constants";
import { quoteArchive } from "./quote";

describe("quoteArchive", () => {
  it("the fee half equals the fixture-pinned estimator for the same bytes", () => {
    const bytes = 208731;
    expect(quoteArchive(bytes).feeSats).toBe(estimateSingleOpReturn(bytes).minerFeeSats);
  });

  it("the price is fee plus exactly the premium", () => {
    const quote = quoteArchive(208731);
    expect(quote.priceSats).toBe(quote.feeSats + WEB_PREMIUM_SATS);
  });

  it("zero bytes quotes zero fee plus the premium", () => {
    expect(quoteArchive(0)).toEqual({
      feeSats: 0,
      premiumSats: WEB_PREMIUM_SATS,
      priceSats: WEB_PREMIUM_SATS,
    });
  });

  // Not one of the three named tests, but the brief's purity rules require a
  // negative or non-finite byte count to be handled totally, not left to
  // produce NaN or negative satoshis. Priced as zero bytes, same as the
  // named zero-bytes case above.
  it.each([-1, -1000, NaN, Infinity, -Infinity])(
    "treats an unrepresentable byte count (%s) as zero bytes, not NaN",
    (bytes) => {
      expect(quoteArchive(bytes)).toEqual({
        feeSats: 0,
        premiumSats: WEB_PREMIUM_SATS,
        priceSats: WEB_PREMIUM_SATS,
      });
    },
  );
});
