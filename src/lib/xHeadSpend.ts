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
 * `X_API_HEAD_BUDGET_USD` a day and CANNOT reach the customers' budget, because
 * it is accounted in a different key. The worst an abuser achieves is denying
 * price discovery — bounded, self-healing at the UTC day boundary, and visible
 * as a refusal rather than a bill.
 *
 * Fails CLOSED, exactly as `reserveXApiSpend` does: without a store we cannot
 * count the spend, so we refuse rather than spend money we cannot account for.
 * That is the opposite of the submit throttle, which is open by design because
 * it guards a pipeline rather than a purse.
 */

/** A profile head returns exactly one resource, and X bills per resource returned. */
export const HEAD_RESOURCES = 1;

/**
 * A hundred unpaid head reads a day. Generous against real price discovery,
 * cheap against abuse, and a small fraction of the paid budget so exhausting it
 * leaves the paying path untouched.
 */
export const DEFAULT_HEAD_BUDGET_USD = 0.5;

/** Two days, so a late release cannot resurrect a stale bucket. */
const KEY_TTL_SECONDS = 48 * 3600;

/** Reads only the one variable it needs, so a test can pass a bare object. */
export function headBudgetUsd(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.X_API_HEAD_BUDGET_USD);
  return Number.isFinite(raw) && raw >= 0 && env.X_API_HEAD_BUDGET_USD !== ""
    ? raw
    : DEFAULT_HEAD_BUDGET_USD;
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
