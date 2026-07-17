// The web quote: a flat £1, converted to satoshis at the live exchange rate
// at quote time. Pure — the rate comes in as an argument; no network, no
// clock, no randomness in here.
//
// The miner-fee half of the decomposition is delegated to
// estimateSingleOpReturn (src/lib/archiveCost.ts), the estimator the
// showroom's own cost quote already calls, itself pinned to the Swift app's
// fixture. This module must never compute a fee of its own — a second
// formula is a second chance for the web page to disagree with the wallet
// about what an archive costs. The premium is what remains of the pound
// after the fee: the worker pays `premiumSats` to revenue and spends
// `funding − premiumSats` on the inscription, so the decomposition is
// load-bearing even though the visitor only ever sees the £1.
//
// Fail-closed by construction: no live rate → no quote; a price that no
// longer covers the miner fee plus dust → no quote. Money is never taken
// for a job the worker would refuse.

import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { WEB_PRICE_GBP } from "./constants";

export type Quote = {
  feeSats: number;
  premiumSats: number;
  priceSats: number;
};

/** Why a quote can refuse: the pound leg has no live rate, or the flat
 * price has been overtaken by the miner fee (BSV at roughly £1,000 —
 * about 92x the 2026-07-17 rate — or a fee-rate change). Both refuse at
 * quote time so money is never taken for an uninscribable job. */
export type QuoteResult =
  | { kind: "quoted"; quote: Quote }
  | { kind: "rate-unavailable" }
  | { kind: "price-below-fee" };

/** The sweep's own dust floor (scripts/xtext-worker/sweep.mjs): a premium at
 * or below this is unpayable to revenue, so the quote refuses. */
const DUST_SATS = 546;

/** A negative or non-finite byte count is not an archive; price it as zero
 * bytes rather than let it produce an unrepresentable quote (NaN, or
 * negative satoshis) further down the payment path. */
function normalizedBytes(archiveBytes: number): number {
  return Number.isFinite(archiveBytes) && archiveBytes > 0 ? archiveBytes : 0;
}

/** price = £1 at the live rate; premium = price − fee. */
export function quoteArchive(archiveBytes: number, gbpPerBsv: number | undefined): QuoteResult {
  if (gbpPerBsv === undefined || !Number.isFinite(gbpPerBsv) || gbpPerBsv <= 0) {
    return { kind: "rate-unavailable" };
  }
  const feeSats = estimateSingleOpReturn(normalizedBytes(archiveBytes)).minerFeeSats;
  const priceSats = Math.ceil((100_000_000 * WEB_PRICE_GBP) / gbpPerBsv);
  const premiumSats = priceSats - feeSats;
  if (premiumSats <= DUST_SATS) {
    return { kind: "price-below-fee" };
  }
  return { kind: "quoted", quote: { feeSats, premiumSats, priceSats } };
}
