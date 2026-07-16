// The web quote: the same miner fee the app's own estimator would charge,
// plus one flat premium. Pure — no network, no clock, no randomness.
//
// The fee half is delegated to estimateSingleOpReturn (src/lib/archiveCost.ts),
// the estimator the showroom's own cost quote already calls, itself pinned to
// the Swift app's fixture. This module must never compute a fee of its own —
// a second formula is a second chance for the web page to disagree with the
// wallet about what an archive costs.
//
// There is no reward output on the web path (a settled spec decision), so
// only estimateSingleOpReturn's minerFeeSats field is used; its rewardSats
// and totalSats describe the app's own (unrelated) developer-reward path.

import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { WEB_PREMIUM_SATS } from "./constants";

export type Quote = {
  feeSats: number;
  premiumSats: number;
  priceSats: number;
};

/** A negative or non-finite byte count is not an archive; price it as zero
 * bytes rather than let it produce an unrepresentable quote (NaN, or
 * negative satoshis) further down the payment path. */
function normalizedBytes(archiveBytes: number): number {
  return Number.isFinite(archiveBytes) && archiveBytes > 0 ? archiveBytes : 0;
}

/** price = fee + WEB_PREMIUM_SATS. */
export function quoteArchive(archiveBytes: number): Quote {
  const feeSats = estimateSingleOpReturn(normalizedBytes(archiveBytes)).minerFeeSats;
  return {
    feeSats,
    premiumSats: WEB_PREMIUM_SATS,
    priceSats: feeSats + WEB_PREMIUM_SATS,
  };
}
