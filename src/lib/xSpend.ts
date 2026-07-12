import { getRedis } from "./redis";

/**
 * A hard, fail-closed ceiling on what the X API may cost us in a day.
 *
 * X bills per resource RETURNED, not per request — "$0.005 per resource" for
 * Posts: Read (docs.x.com/x-api/getting-started/pricing). One page of a timeline
 * is 100 posts, so one page is 50 cents. A whole timeline is ~3200 posts: $16.
 * The "owned read" rate of $0.001 does not apply to us: it requires the
 * authenticated account to be the owner of the developer app, so every read of a
 * customer's timeline is billed at the full rate.
 *
 * The per-address rate limiter is not a spend limit. It bounds one caller; it says
 * nothing about a hundred callers, and it disappears entirely if Redis is
 * unreachable. This module is the actual ceiling: an account of the day's spend,
 * reserved BEFORE the money is spent, that refuses when the budget is gone and
 * refuses again when it cannot tell.
 */

/** Dollars X charges for one resource returned. */
export const USD_PER_RESOURCE = 0.005;

/** Spend is accounted in thousandths of a dollar so Redis holds an integer. */
const MILS_PER_USD = 1000;

/** Redis keys hold two days so a late reservation cannot resurrect a stale bucket. */
const KEY_TTL_SECONDS = 48 * 3600;

export const DEFAULT_DAILY_BUDGET_USD = 2;

/** Reads only the one variable it needs, so a test can pass a bare object. */
export function dailyBudgetUsd(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.X_API_DAILY_BUDGET_USD);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DAILY_BUDGET_USD;
}

/** Pure. What X will charge for `resources` returned rows. */
export function resourcesToUsd(resources: number): number {
  return Math.max(0, resources) * USD_PER_RESOURCE;
}

/** Pure. Thousandths of a dollar, rounded up — never under-charge ourselves. */
export function usdToMils(usd: number): number {
  return Math.ceil(usd * MILS_PER_USD);
}

/** Pure. The decision, so it can be tested without Redis. */
export function withinBudget(spentMils: number, budgetUsd: number): boolean {
  return spentMils <= usdToMils(budgetUsd);
}

/** Pure. Which day's bucket a moment belongs to, in UTC. */
export function spendKey(now: Date): string {
  return `xapi:spend:${now.toISOString().slice(0, 10)}`;
}

export type Reservation =
  | { ok: true; reservedUsd: number }
  | { ok: false; reason: "budget-exhausted" | "accounting-unavailable" };

/**
 * Reserve the worst-case cost of a call before making it.
 *
 * Fails CLOSED. If Redis is unreachable we cannot account for the spend, so we
 * refuse rather than spend money we cannot count. That is the opposite of the
 * rate limiter this replaces, which silently allowed everything when Redis was
 * absent — on the one endpoint where being wrong costs cash.
 */
export async function reserveXApiSpend(
  worstCaseResources: number,
  now: Date = new Date(),
  budgetUsd: number = dailyBudgetUsd(),
): Promise<Reservation> {
  const redis = getRedis();
  if (!redis) return { ok: false, reason: "accounting-unavailable" };

  const usd = resourcesToUsd(worstCaseResources);
  const mils = usdToMils(usd);
  const key = spendKey(now);

  const spent = await redis.incrby(key, mils);
  if (spent === mils) await redis.expire(key, KEY_TTL_SECONDS);

  if (!withinBudget(spent, budgetUsd)) {
    await redis.decrby(key, mils); // give the reservation back
    return { ok: false, reason: "budget-exhausted" };
  }
  return { ok: true, reservedUsd: usd };
}

/**
 * Hand a reservation back — for a read that was reserved but never happened.
 *
 * The gate reserves BEFORE it burns the payment (a budget refusal must never
 * consume a user's money), so a burn that then fails leaves budget held for a
 * read nobody will take. Releasing it keeps the day's ceiling honest. Failing
 * to release would only ever make us serve FEWER reads than we are entitled to,
 * which is why this is safe to let fail quietly.
 */
export async function releaseXApiSpend(
  worstCaseResources: number,
  now: Date = new Date(),
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.decrby(spendKey(now), usdToMils(resourcesToUsd(worstCaseResources)));
}
