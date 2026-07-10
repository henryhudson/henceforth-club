/**
 * Tuning constants for the web-paid inscription path.
 *
 * WEB_PREMIUM_SATS — a one-off manual derivation, not a runtime lookup.
 * WhatsOnChain exchange rate, read by hand on 2026-07-10:
 *   curl -s https://api.whatsonchain.com/v1/bsv/main/exchangerate
 *   → { "rate": 13.625, "currency": "USD" }   (1 bitcoin SV = 13.625 United States dollars)
 * Pounds per dollar: 0.79 (the site's existing conversion constant, see
 * src/app/text/_components/CostQuote.tsx).
 *   1 bitcoin SV = 13.625 × 0.79 = 10.76375 pounds
 *   satoshis per pound = 100,000,000 ÷ 10.76375 = 9,290,442.46
 * Rounded to the nearest thousand: 9,290,000 satoshis (about 99.995 pence
 * at the rate above). This constant does not track the price after today;
 * updating it later means repeating this arithmetic by hand and editing
 * both the number and this comment together.
 */
export const WEB_PREMIUM_SATS = 9_290_000;

/** How long a quote is honoured before the visitor must ask for a new one. */
export const QUOTE_EXPIRY_MINUTES = 15;

/** How many ephemeral jobs may be funded and unswept at the same time. */
export const MAX_CONCURRENT_JOBS = 4;

/** The archive byte ceiling every task in this plan enforces. */
export const MAX_ARCHIVE_BYTES = 1_000_000;

/** How many times the worker retries a failed broadcast before giving up. */
export const BROADCAST_RETRIES = 3;

/** How long the late-payment watcher keeps checking an expired job's address. */
export const LATE_WATCH_DAYS = 7;
