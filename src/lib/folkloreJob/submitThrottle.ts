import type { Redis } from "@upstash/redis";
import { getRedis } from "@/lib/redis";
import { QUOTE_EXPIRY_MINUTES } from "./constants";

// The submit route's per-address allowance.
//
// Opening a job is free — no auth, no payment, nothing spent — but a
// "quoted" job immediately occupies one of the four concurrent custody slots
// (MAX_CONCURRENT_JOBS), and that ceiling is SHARED with the paid archive
// route. Four sixty-byte posts could therefore hold the whole pipeline at
// capacity for a full quote expiry and be replayed forever at zero cost,
// denying every genuine submission on either route.
//
// The allowance bounds how much of that shared pipeline any one address can
// be holding at once. It is deliberately smaller than the ceiling: with two
// of four slots reachable per address, a majority of the pipeline always
// remains for everybody else, so a free flood can no longer deny a paid
// submission. The window matches the quote expiry because that is exactly
// how long an unpaid job can keep its slot — allowance and occupancy expire
// together, so nobody is ever refused for jobs that have already released.
//
// This is a route-level bound and nothing else: ACTIVE_STATES and the
// capacity accounting in jobStore are untouched, so the archive path keeps
// every protection it had.

/** How many jobs one address may open per window. Under MAX_CONCURRENT_JOBS
 * on purpose — see above. */
export const SUBMIT_QUOTES_PER_ADDRESS = 2;

/** The window, matched to how long an unpaid job holds its slot. */
export const SUBMIT_WINDOW_MINUTES = QUOTE_EXPIRY_MINUTES;

const WINDOW_MS = SUBMIT_WINDOW_MINUTES * 60_000;

const throttleKey = (address: string, window: number) =>
  `folklore:submit:${address}:${window}`;

export type SubmitSlot =
  | { kind: "allowed" }
  | { kind: "throttled"; retryAfterSeconds: number };

/**
 * The client address a request is throttled against. Vercel sets
 * `x-forwarded-for`; the left-most entry is the client as the edge saw it.
 * A request arriving with neither header shares one bucket — conservative on
 * purpose: an unattributable request must not get an unlimited allowance.
 */
export function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Claim one of this address's slots for the current window.
 *
 * The increment happens before the comparison, so a refused attempt still
 * counts — hammering the route keeps the window pinned rather than resetting
 * it. Fixed windows, not a sliding log: the counter is one integer with an
 * expiry, and the worst a boundary allows is two windows' allowance back to
 * back, which is still far below the ceiling this protects.
 *
 * Null-Redis safe, and open by design in that case: without a store there is
 * no pipeline to protect — createJob itself refuses store-unavailable a few
 * lines later — so the throttle must not be the thing that reports the
 * outage.
 */
export async function claimSubmitSlot(
  address: string,
  nowMs: number,
  redis: Redis | null = getRedis(),
): Promise<SubmitSlot> {
  if (!redis) return { kind: "allowed" };

  const window = Math.floor(nowMs / WINDOW_MS);
  const key = throttleKey(address, window);
  const used = await redis.incr(key);
  // Only the first increment sets the expiry: re-setting it on every request
  // would let a steady stream hold the key alive indefinitely.
  if (used === 1) await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
  if (used <= SUBMIT_QUOTES_PER_ADDRESS) return { kind: "allowed" };

  return {
    kind: "throttled",
    retryAfterSeconds: Math.ceil(((window + 1) * WINDOW_MS - nowMs) / 1000),
  };
}
