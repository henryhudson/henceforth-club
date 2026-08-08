import type { Redis } from "@upstash/redis";
import { getRedis } from "./redis";
import { resourcesToUsd, usdToMils, type Reservation } from "./xSpend";

/**
 * The ceiling on UNPAID profile-head reads — its own bucket, deliberately not
 * the paid one.
 *
 * Two routes read a profile head before anyone has paid for anything, and both
 * do it on purpose: `/api/x/quote` cannot tell a caller the price of an archive
 * without first asking X how many posts there are, and `/api/x/archive?full=1`
 * needs the same number to size the fee it demands. A quote a caller must pay
 * for is not a quote, so the half-cent is ours to eat.
 *
 * Ours to eat is not ours to spend without limit, and until now nothing counted
 * it: each of those reads cost $0.005 and was invisible to `xSpend`'s daily
 * ceiling. Both routes' comments named a per-address rate limiter as the
 * control; no limiter was ever applied to either, and each justified itself by
 * pointing at the other.
 *
 * WHY A SEPARATE BUCKET, and not simply `reserveXApiSpend(1)`.
 *
 * Booking these reads against the paid ceiling would bound the bill and break
 * the product. The default budget is $2 — four hundred one-resource
 * reservations — so four hundred anonymous quotes would exhaust the day and
 * every PAYING archive would then be refused. That trades an unbounded bill for
 * a free denial of the paid path, which is a worse failure: money is
 * recoverable, a customer refused at the till is not.
 *
 * A per-address throttle does not fix it either, and `folkloreJob/submitThrottle`
 * says why in its own words: "It does not and cannot bound what many buckets
 * hold together." One bucket is not the quantity that needs bounding here.
 *
 * So unpaid reads get their own, smaller ceiling. Anonymous abuse is capped at
 * `X_API_HEAD_BUDGET_USD` a day and cannot spend a single mil of the customers'
 * BUDGET, because it is accounted in a different Redis key.
 *
 * WHAT THIS DOES NOT DO, stated plainly because an earlier draft of this comment
 * claimed otherwise ("exhausting it leaves the paying path untouched") and that
 * was false. A separate budget is not a separate PATH. `/api/x/archive?full=1`
 * must size its fee before it can demand one, so its head read — and therefore
 * this ceiling — sits in front of the payment gate. Exhaust the head bucket and
 * a paying caller's whole-profile archive is refused 429 as well, until the UTC
 * day turns. Price discovery goes with it, and the app quotes before every
 * purchase, so in practice the paid flow is blocked at its entrance.
 *
 * That is a real limitation and it is accepted deliberately, because the
 * alternative is worse in kind rather than degree: today the same requests are
 * unbounded and simply cost money, with no ceiling at any price. What is bought
 * here is a bound. Isolation from PAID traffic is bought by SETTLEMENT
 * (`settleHeadReadAsPaid` below, 2026-08-08): the ordering problem — the fee
 * cannot be verified before the head read that sizes it — is solved by
 * accounting rather than ordering. The archive route fronts its head read from
 * this bucket exactly as before, and once the payment verifies it moves that
 * half-cent to the paid budget, so sustained paid traffic nets ZERO against
 * this ceiling and cannot lock the entrance for the next paying caller.
 *
 * What remains true, stated so this comment does not oversell in the other
 * direction: reads whose payment never verifies — quotes, and archive taps
 * carrying a well-formed but worthless transaction id — still spend this
 * bucket, and exhausting it still refuses the NEXT full archive at its
 * entrance until the UTC day turns. The archive route demanding a well-formed
 * id BEFORE the read keeps the bucket out of reach of a bare browser request,
 * and the budget is tunable if genuine volume ever gets there.
 *
 * `submitThrottle` puts the rule this comment now obeys: a comment that
 * oversells a protection is worse than none, because the next reader stops
 * checking.
 *
 * Fails CLOSED, exactly as `reserveXApiSpend` does: without a store we cannot
 * count the spend, so we refuse rather than spend money we cannot account for.
 * That is the opposite of the submit throttle, which is open by design because
 * it guards a pipeline rather than a purse.
 */

/** A profile head returns exactly one resource, and X bills per resource returned. */
export const HEAD_RESOURCES = 1;

/**
 * A hundred unpaid head reads a day — generous against real price discovery at
 * today's volumes, cheap against abuse, and a small fraction of the paid budget
 * so exhausting it costs the customers' budget nothing.
 *
 * It does NOT leave the paying path untouched; see the note above. Raise
 * `X_API_HEAD_BUDGET_USD` if genuine quote volume ever approaches a hundred a
 * day, because the refusal lands on customers as well as abusers.
 */
export const DEFAULT_HEAD_BUDGET_USD = 0.5;

/** Two days, so a late release cannot resurrect a stale bucket. */
const KEY_TTL_SECONDS = 48 * 3600;

/**
 * Reads only the one variable it needs, so a test can pass a bare object.
 *
 * BLANK IS UNSET, deliberately, matching the sibling `dailyBudgetUsd`.
 * `Number("")` and `Number(" ")` are both 0, so coercing first reads a
 * variable that exists but holds nothing as a ZERO budget — which refuses
 * every read rather than falling back to the default. A blank value is the
 * most likely way this is misconfigured (a deployment setting present but
 * empty), and it must not be the way the feature turns itself off.
 */
export function headBudgetUsd(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.X_API_HEAD_BUDGET_USD?.trim();
  if (!raw) return DEFAULT_HEAD_BUDGET_USD;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_HEAD_BUDGET_USD;
}

/** Pure. Which day's UNPAID bucket a moment belongs to, in UTC. */
export function headSpendKey(now: Date): string {
  return `xapi:head:${now.toISOString().slice(0, 10)}`;
}

/**
 * Reserve the one resource an unpaid head read costs.
 *
 * `now` is explicit so a caller can pass the SAME moment to the release,
 * keeping a reserve/release pair inside one UTC bucket. A pair that straddles
 * midnight would decrement a day that had never been incremented.
 *
 * `redis` is a defaulted parameter rather than an internal lookup, matching
 * `submitThrottle`, `xRefusalLog` and `xVotes`, so the accounting is testable
 * by injection instead of by module mocking.
 */
export async function reserveHeadRead(
  now: Date = new Date(),
  redis: Redis | null = getRedis(),
  budgetUsd: number = headBudgetUsd(),
): Promise<Reservation> {
  if (!redis) return { ok: false, reason: "accounting-unavailable" };

  const usd = resourcesToUsd(HEAD_RESOURCES);
  const mils = usdToMils(usd);
  const key = headSpendKey(now);

  const spent = await redis.incrby(key, mils);
  if (spent === mils) await redis.expire(key, KEY_TTL_SECONDS);

  if (spent > usdToMils(budgetUsd)) {
    await redis.decrby(key, mils); // hand the over-budget reservation back
    return { ok: false, reason: "budget-exhausted" };
  }
  return { ok: true, reservedUsd: usd };
}

/**
 * Hand a head reservation back, for a read that cost nothing.
 *
 * X bills per resource RETURNED, so a handle that does not exist is billed at
 * zero — holding budget for it would shrink the day's allowance by a read
 * nobody was charged for. That matters more than it sounds: the handle pattern
 * admits any short alphanumeric string, so without this, requesting nonsense
 * handles would be a free way to pin the day's ceiling.
 *
 * FLOORED AT ZERO, unlike `releaseXApiSpend`. An unfloored decrement can drive
 * the bucket negative, and a negative bucket is a ceiling LARGER than the
 * budget for the rest of the day — the one way this system can spend more than
 * it was configured to.
 */
export async function releaseHeadRead(
  now: Date = new Date(),
  redis: Redis | null = getRedis(),
): Promise<void> {
  if (!redis) return;
  const mils = usdToMils(resourcesToUsd(HEAD_RESOURCES));
  const key = headSpendKey(now);
  const after = await redis.decrby(key, mils);
  if (after < 0) await redis.incrby(key, -after);
}

/**
 * Move a VERIFIED payment's head read from the unpaid bucket to the paid one.
 *
 * `/api/x/archive?full=1` must front its head read from the unpaid bucket,
 * because the fee cannot be verified before the post count the head discovers.
 * Without settlement every paid archive therefore consumed a slot of the
 * unpaid ceiling, and a hundred paid reads a day locked the entrance for the
 * next paying caller — the isolation gap the module comment above names.
 * Settling after the gate makes paid traffic net zero here: the ceiling is
 * spent only by reads that never verified a payment.
 *
 * This is deliberately HALF the move — the decrement. The increment is not
 * made here because the paid bucket already holds it: on the full-archive
 * path the gate reserves `resourcesForPosts(billedPosts)` = one user object
 * plus the posts, and that one user object books a head read the post-gate
 * code no longer makes (the head is handed to `fetchXArchive` as an argument,
 * 2026-08-06). That spare resource IS the fronted head read's paid booking.
 * Incrementing the paid bucket here as well would book the same half-cent
 * twice and shut the paid ceiling early.
 *
 * `now` has NO default, unlike its siblings: the settle is only correct at
 * the reservation's own moment, and forcing the caller to pass it is what
 * keeps the pair inside one UTC bucket — a settle that straddled midnight
 * would decrement a day that was never incremented.
 *
 * Call it exactly once per request, only after `payAndReserve` succeeds. It
 * shares `releaseHeadRead`'s floor at zero, so even a duplicated settle
 * cannot drive the bucket negative — a negative bucket is a ceiling LARGER
 * than the budget, the one way this system could overspend.
 */
export async function settleHeadReadAsPaid(
  now: Date,
  redis: Redis | null = getRedis(),
): Promise<void> {
  await releaseHeadRead(now, redis);
}
