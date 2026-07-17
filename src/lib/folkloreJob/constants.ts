/**
 * Tuning constants for the web-paid inscription path.
 */

/** The web archive's whole price, in pounds. Converted to satoshis at the
 * LIVE rate at quote time (src/lib/xPrice.ts gbpPerBsv) — never from a
 * frozen constant; when the rate is unavailable the quote fails closed.
 * (The predecessor here was WEB_PREMIUM_SATS = 9,290,000 — one pound
 * hand-converted on 2026-07-10 and never tracking the price again.) */
export const WEB_PRICE_GBP = 1;

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
