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

const FRANKFURTER_RATE = "https://api.frankfurter.app/latest?from=USD&to=GBP";
/** Currency pairs drift slowly. An hour was calibrated for display, and the
 * flat-£1 charge now rides it too (see gbpPerBsv) — acceptable because
 * intra-hour pound drift on a £1 price is sub-penny, but shortening this is
 * a money decision, not a display one. */
const POUND_CACHE_MS = 60 * 60 * 1000;

let poundCache: { gbpPerUsd: number; at: number } | null = null;

export type PoundRate = { ok: true; gbpPerUsd: number } | { ok: false; reason: "rate-unavailable" };

/**
 * The European Central Bank's USD→GBP rate (via frankfurter.app — free, no
 * key), cached for an hour. MONEY-BEARING since the flat-£1 web archive
 * (2026-07-17): gbpPerBsv multiplies this into the charged price on
 * /api/folklore/job, so isUsableRate and the cache policy guard real money —
 * a failure fails the quote closed rather than mispricing it. On the display
 * surfaces a failure still just omits the pound figure. It replaced a
 * hardcoded `GBP_PER_USD = 0.79` that silently drifted with every currency
 * move.
 */
export async function gbpPerUsd(
  fetchFn: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<PoundRate> {
  if (poundCache && now - poundCache.at < POUND_CACHE_MS) {
    return { ok: true, gbpPerUsd: poundCache.gbpPerUsd };
  }
  try {
    const res = await fetchFn(FRANKFURTER_RATE, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: "rate-unavailable" };
    const rate = (await res.json())?.rates?.GBP;
    if (!isUsableRate(rate)) return { ok: false, reason: "rate-unavailable" };
    poundCache = { gbpPerUsd: rate, at: now };
    return { ok: true, gbpPerUsd: rate };
  } catch {
    return { ok: false, reason: "rate-unavailable" };
  }
}

/** Pure. What `sats` is worth in pounds at the given rates. */
export function satsToPounds(sats: number, bsvUsdRate: number, gbpPerUsdRate: number): number {
  return (sats / SATS_PER_BSV) * bsvUsdRate * gbpPerUsdRate;
}

/**
 * Pounds per whole coin, or undefined when either rate is unavailable.
 * Display callers render the pound figure only when it is real — and since
 * the flat-£1 web archive this is also the rate that SETS the charged price
 * (src/lib/folkloreJob/quote.ts), whose quote fails closed on undefined.
 */
export async function gbpPerBsv(
  fetchFn: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<number | undefined> {
  const [usd, gbp] = await Promise.all([bsvUsd(fetchFn, now), gbpPerUsd(fetchFn, now)]);
  return usd.ok && gbp.ok ? usd.bsvUsd * gbp.gbpPerUsd : undefined;
}

/** Test seam: forget the cached rates. */
export function resetPriceCache(): void {
  cache = null;
  poundCache = null;
}
