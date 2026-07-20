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
// What this module is, exactly, and what it is NOT. It bounds how much of the
// shared pipeline ONE bucket can hold at a time. It does not and cannot bound
// what many buckets hold together, so it is not what keeps the paid path
// alive — the earlier version of this comment claimed otherwise ("two
// windows' allowance ... still far below the ceiling", when two windows'
// allowance was four, the ceiling itself), and a comment that oversells a
// protection is worse than none: the next reader stops checking. The
// guarantee lives in jobStore, where RESERVED_ARCHIVE_JOBS slots are held
// back from the free path entirely, whatever any allowance permits.
//
// This is a route-level bound and nothing else: ACTIVE_STATES and the
// capacity accounting in jobStore are untouched, so the archive path keeps
// every protection it had.

/** How many jobs one bucket may hold across any two adjacent windows. */
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
 * The routed /64 an IPv6 address sits in, or null for anything that is not a
 * plain IPv6 address.
 *
 * A /64 is the smallest block an internet provider hands one customer, so
 * keying the allowance on the full address gave a single connection an
 * effectively unlimited supply of distinct buckets. Text form is expanded
 * first (`::` compression, zone id, brackets) so that one prefix cannot be
 * spelled two ways and counted twice. Anything with an embedded IPv4 part, or
 * any malformed input, returns null and is keyed whole — stricter, never
 * looser.
 */
export function ipv6Prefix(address: string): string | null {
  const bare = address.replace(/^\[/, "").replace(/\]$/, "").split("%")[0];
  if (!bare.includes(":") || bare.includes(".")) return null;

  const halves = bare.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let hextets: string[];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    hextets = head;
  } else {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    hextets = [...head, ...Array<string>(fill).fill("0"), ...tail];
  }
  if (!hextets.every((h) => /^[0-9a-fA-F]{1,4}$/.test(h))) return null;

  return `${hextets
    .slice(0, 4)
    .map((h) => h.replace(/^0+(?=.)/, "").toLowerCase())
    .join(":")}::/64`;
}

/**
 * The bucket a request is throttled against. Vercel sets `x-forwarded-for`;
 * the left-most entry is the client as the edge saw it. IPv6 collapses to its
 * /64 (see above); IPv4 is the address itself. A request arriving with neither
 * header shares one bucket — conservative on purpose: an unattributable
 * request must not get an unlimited allowance.
 */
export function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const raw = first || req.headers.get("x-real-ip")?.trim() || "unknown";
  return ipv6Prefix(raw) ?? raw;
}

/**
 * Claim one of this bucket's slots.
 *
 * The increment happens before the comparison, so a refused attempt still
 * counts — hammering the route keeps the window pinned rather than resetting
 * it.
 *
 * Two counters, not one: the current window's and the previous window's, added
 * together. A single fixed window let a bucket spend its whole allowance at
 * the end of one window and its whole allowance again at the start of the
 * next, holding twice the allowance concurrently for as long as an unpaid job
 * keeps its slot. Summing the pair bounds any two adjacent windows — and any
 * instant, since the counters expire — at exactly SUBMIT_QUOTES_PER_ADDRESS.
 * The counter therefore has to outlive its own window, hence the two-window
 * expiry.
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
  if (used === 1) await redis.expire(key, Math.ceil((2 * WINDOW_MS) / 1000));
  const carried = (await redis.get<number>(throttleKey(address, window - 1))) ?? 0;
  if (used + carried <= SUBMIT_QUOTES_PER_ADDRESS) return { kind: "allowed" };

  // When the allowance really returns, not when the window happens to tick.
  // This window's count is next window's carry, so a bucket that has already
  // spent the whole allowance is still refused at the next boundary; saying
  // otherwise would send a well-behaved client back to be refused again.
  const windowsToWait = 1 + used <= SUBMIT_QUOTES_PER_ADDRESS ? 1 : 2;
  return {
    kind: "throttled",
    retryAfterSeconds: Math.ceil(((window + windowsToWait) * WINDOW_MS - nowMs) / 1000),
  };
}
