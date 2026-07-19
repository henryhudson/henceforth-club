// The link submit's quote: the record's inscription fee plus a ten-pence
// floor, both in satoshis at the live exchange rate at quote time. Pure —
// the rate comes in as an argument; no network, no clock, no randomness.
//
// The fee half is delegated to estimateSingleOpReturn (src/lib/archiveCost.ts)
// exactly as the archive quote's is — this module must never compute a fee of
// its own; a second formula is a second chance to disagree about what an
// inscription costs (the warning atop quote.ts).
//
// The floor is the spam deterrent (spec Q1): trivial for an honest submitter,
// real enough that a flood costs real money. It rides the job record as
// premiumSats — the worker already pays any premium to the revenue address,
// and price − fee − premium is then exactly zero, so a link job never touches
// the float pool. No schema change, no new worker leg.
//
// Fail-closed by construction, the quote.ts posture: no live rate → no quote;
// a floor at or below dust (a coin dearer than roughly £18,315) → no quote.
// Money is never taken for a job the worker would refuse.

import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { DUST_SATS, type Quote } from "./quote";

/** The pence-level floor Henry set for a single link or comment (spec Q1). */
export const LINK_FLOOR_PENCE = 10;

const LINK_FLOOR_POUNDS = LINK_FLOOR_PENCE / 100;

/** A negative or non-finite byte count is not a record; price it as zero
 * bytes rather than let it produce an unrepresentable quote. */
function normalizedBytes(recordBytes: number): number {
  return Number.isFinite(recordBytes) && recordBytes > 0 ? recordBytes : 0;
}

/** price = inscription fee + ten pence at the live rate; the floor is the
 * premium (revenue), and the float leg is exactly zero. */
export function quoteLink(recordBytes: number, gbpPerBsv: number | undefined): Quote | null {
  if (gbpPerBsv === undefined || !Number.isFinite(gbpPerBsv) || gbpPerBsv <= 0) return null;
  const feeSats = estimateSingleOpReturn(normalizedBytes(recordBytes)).minerFeeSats;
  const floorSats = Math.ceil((100_000_000 * LINK_FLOOR_POUNDS) / gbpPerBsv);
  if (floorSats <= DUST_SATS) return null;
  return { feeSats, floatSats: 0, premiumSats: floorSats, priceSats: feeSats + floorSats };
}

/** The same quote collapsed to its total, or null — fail closed. */
export function quoteLinkSats(recordBytes: number, gbpPerBsv: number | undefined): number | null {
  return quoteLink(recordBytes, gbpPerBsv)?.priceSats ?? null;
}
