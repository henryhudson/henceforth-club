// The web quote: the archive's inscription fee plus the £2 kudos float leg,
// both converted to satoshis at the live exchange rate at quote time. Pure —
// the rate comes in as an argument; no network, no clock, no randomness in
// here.
//
// The fee half of the decomposition is delegated to estimateSingleOpReturn
// (src/lib/archiveCost.ts), the estimator the showroom's own cost quote
// already calls, itself pinned to the Swift app's fixture. This module must
// never compute a fee of its own — a second formula is a second chance for
// the web page to disagree with the wallet about what an archive costs.
//
// The £2 is not revenue: it funds the buyer's kudos float (2,000 kudos at a
// tenth of a penny each, credited when the job completes), and the worker
// pays the float leg on-chain to the float pool address. premiumSats stays in
// the decomposition at zero so the record schema the worker reads is
// untouched: the worker derives the float leg as price − fee − premium, which
// is exactly zero for any £1-era job still in flight and exactly the £2 leg
// for a job quoted here.
//
// Fail-closed by construction: no live rate → no quote; a float leg at or
// below dust (a coin dearer than roughly £366,000) → no quote. Money is
// never taken for a job the worker would refuse.

import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { FLOAT_POUNDS } from "@/lib/kudos/constants";

export type Quote = {
  feeSats: number;
  floatSats: number;
  premiumSats: number;
  priceSats: number;
};

/** Why a quote can refuse: the pound leg has no live rate, or the £2 float
 * leg has fallen to dust and could not be paid to the pool on-chain. Both
 * refuse at quote time so money is never taken for an uninscribable job. */
export type QuoteResult =
  | { kind: "quoted"; quote: Quote }
  | { kind: "rate-unavailable" }
  | { kind: "price-below-fee" };

/** The sweep's own dust floor (scripts/xtext-worker/sweep.mjs): a float leg at
 * or below this is unpayable to the pool, so the quote refuses. */
const DUST_SATS = 546;

/** A negative or non-finite byte count is not an archive; price it as zero
 * bytes rather than let it produce an unrepresentable quote (NaN, or
 * negative satoshis) further down the payment path. */
function normalizedBytes(archiveBytes: number): number {
  return Number.isFinite(archiveBytes) && archiveBytes > 0 ? archiveBytes : 0;
}

/** price = inscription fee + £2 at the live rate; the £2 is the float leg. */
export function quoteArchive(archiveBytes: number, gbpPerBsv: number | undefined): QuoteResult {
  if (gbpPerBsv === undefined || !Number.isFinite(gbpPerBsv) || gbpPerBsv <= 0) {
    return { kind: "rate-unavailable" };
  }
  const feeSats = estimateSingleOpReturn(normalizedBytes(archiveBytes)).minerFeeSats;
  const floatSats = Math.ceil((100_000_000 * FLOAT_POUNDS) / gbpPerBsv);
  if (floatSats <= DUST_SATS) {
    return { kind: "price-below-fee" };
  }
  return { kind: "quoted", quote: { feeSats, floatSats, premiumSats: 0, priceSats: feeSats + floatSats } };
}
