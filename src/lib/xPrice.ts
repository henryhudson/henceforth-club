/**
 * The payment floor, computed at the moment of sale from the moment's BSV price.
 *
 * Henry's rule: "we must make a profit at the time of sale in terms of the BSV
 * price." A floor pinned to a constant only obeys that rule on the day it was
 * written. If BSV falls far enough, a pinned floor keeps accepting payments that
 * no longer cover what X charges — and nothing says so. It simply bleeds.
 *
 * So the floor is derived: dollars X will charge us, converted at the rate right
 * now, plus a margin. WhatsOnChain's exchange-rate endpoint is free and we already
 * call WhatsOnChain to verify the payment itself, so this costs nothing.
 *
 * If the rate cannot be read we refuse the call. Failing closed on a price feed is
 * the whole point: a guess about the price is a guess about whether we make money,
 * and we would rather serve nobody than serve someone at a loss we cannot see.
 */

const WOC_RATE = "https://api.whatsonchain.com/v1/bsv/main/exchangerate";
const SATS_PER_BSV = 100_000_000;

/** How much more than cost we require. 1.25 is a quarter over. */
export const MARGIN = 1.25;

/** A price older than this is refetched. Matches the app's own 60-second cache. */
const CACHE_MS = 60_000;

let cache: { usd: number; at: number } | null = null;

/** Pure. Satoshis needed to cover `usd` at `bsvUsd`, with margin, rounded up. */
export function satsForUsd(usd: number, bsvUsd: number, margin: number = MARGIN): number {
  if (!(bsvUsd > 0) || !(usd >= 0)) return Number.POSITIVE_INFINITY;
  return Math.ceil((usd * margin) / bsvUsd * SATS_PER_BSV);
}

/** Pure. A rate is usable only if it is a positive, finite number of dollars. */
export function isUsableRate(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

export type Price = { ok: true; bsvUsd: number } | { ok: false; reason: "price-unavailable" };

/** Reads the free WhatsOnChain rate, cached for a minute. Fails closed. */
export async function bsvUsd(
  fetchFn: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<Price> {
  if (cache && now - cache.at < CACHE_MS) return { ok: true, bsvUsd: cache.usd };

  try {
    const res = await fetchFn(WOC_RATE, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: "price-unavailable" };
    const rate = (await res.json())?.rate;
    if (!isUsableRate(rate)) return { ok: false, reason: "price-unavailable" };
    cache = { usd: rate, at: now };
    return { ok: true, bsvUsd: rate };
  } catch {
    return { ok: false, reason: "price-unavailable" };
  }
}

/** Test seam: forget the cached rate. */
export function resetPriceCache(): void {
  cache = null;
}
