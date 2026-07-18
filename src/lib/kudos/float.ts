import type { Redis } from "@upstash/redis";
import { dateKey, getRedis } from "../redis";
import { DAILY_DUEL_CAP } from "./constants";

// The float accounting core — the money half of the kudos economy. Five
// integer counters per participant, all in kudos units (pounds and satoshis
// exist only at the funding and settlement edges, outside this module):
//
//   kudos:funded:<profile>    total kudos ever funded into the profile
//   kudos:float:<profile>     spendable balance now
//   kudos:spent:<profile>     total kudos ever debited from the float
//   kudos:earned:<handle>     accrued kudos awaiting settlement
//   kudos:settled:<handle>    total kudos settled on-chain
//
// The conservation invariant (design section five, tested as a property):
// per profile `funded = float + spent`, and globally — once every debit has
// accrued to its winner — `funded = float + earned_unsettled + settled`.
// A kudos is never minted, never double-spent, never lost to rounding.
//
// Ordering, stated once and obeyed throughout: DEBIT THEN RECORD. Every
// movement takes the money out with a single atomic decrement first and
// writes the bookkeeping record second, so a crash between the two can only
// lose a record (healable by reconcile), never leave a balance that can be
// spent or paid twice. The atomic decrement's return value is also the race
// guard: two contending debits both decrement, the one that drove the
// balance negative refunds itself and reports `insufficient` — the balance
// is server-authoritative and never spendably negative.

const fundedKey = (profile: string) => `kudos:funded:${profile.toLowerCase()}`;
const floatKey = (profile: string) => `kudos:float:${profile.toLowerCase()}`;
const spentKey = (profile: string) => `kudos:spent:${profile.toLowerCase()}`;
const earnedKey = (handle: string) => `kudos:earned:${handle.toLowerCase()}`;
const settledKey = (handle: string) => `kudos:settled:${handle.toLowerCase()}`;
const duelCountKey = (profile: string, day: string) =>
  `kudos:duelcount:${profile.toLowerCase()}:${day}`;

/** A kudos amount is a positive safe integer — fractional, zero, negative
 * and unsafe amounts are refused before anything is touched. */
const invalidAmount = (amount: number): boolean =>
  !Number.isSafeInteger(amount) || amount < 1;

export type FundFloatResult =
  | { kind: "recorded"; float: number }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export type DebitForDuelResult =
  | { kind: "recorded"; float: number }
  | { kind: "insufficient"; float: number }
  | { kind: "capped" }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export type DebitForTipResult =
  | { kind: "recorded"; float: number }
  | { kind: "insufficient"; float: number }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export type AccrueEarnedResult =
  | { kind: "recorded"; earned: number }
  | { kind: "invalid" }
  | { kind: "unavailable" };

export type MarkSettledResult =
  | { kind: "recorded"; settled: number }
  | { kind: "insufficient"; earned: number }
  | { kind: "invalid" }
  | { kind: "unavailable" };

/** A profile's giver-side books. `funded = float + spent` always. */
export type ProfileAccount = { funded: number; float: number; spent: number };

/** A handle's receiver-side books. Settlement moves kudos between the two
 * without changing their sum. */
export type HandleAccount = { earned: number; settled: number };

/**
 * Credit a profile's float — the £2 leg landing as 2,000 kudos, or a Stripe
 * webhook's closed-loop points. Record then credit: the funding total is
 * written before the spendable balance, so a crash between the two leaves
 * the platform owing the buyer (visible in the books, healable), never a
 * spendable balance with no funding behind it — that would be minting.
 */
export async function fundFloat(
  profile: string,
  amount: number,
  redis: Redis | null = getRedis(),
): Promise<FundFloatResult> {
  if (invalidAmount(amount)) return { kind: "invalid" };
  if (!redis) return { kind: "unavailable" };
  await redis.incrby(fundedKey(profile), amount);
  const float = await redis.incrby(floatKey(profile), amount);
  return { kind: "recorded", float };
}

/**
 * Debit a profile's float for a resolved duel. Three steps, each atomic:
 * claim one of the day's duel slots (the per-float daily cap bounds what
 * self-kudos can do to the table), debit the float, record the spend —
 * debit then record, per the module contract. A claim or debit that fails
 * refunds itself, so `capped` and `insufficient` leave every counter
 * exactly as it was.
 */
export async function debitForDuel(
  profile: string,
  amount: number,
  day: string = dateKey(),
  redis: Redis | null = getRedis(),
): Promise<DebitForDuelResult> {
  if (invalidAmount(amount)) return { kind: "invalid" };
  if (!redis) return { kind: "unavailable" };

  const slot = await redis.incr(duelCountKey(profile, day));
  if (slot > DAILY_DUEL_CAP) {
    await redis.decr(duelCountKey(profile, day));
    return { kind: "capped" };
  }

  const float = await redis.decrby(floatKey(profile), amount);
  if (float < 0) {
    // The atomic decrement went past zero: this debit lost the race (or the
    // float was simply short). Refund the debit and release the day's slot.
    await redis.incrby(floatKey(profile), amount);
    await redis.decr(duelCountKey(profile, day));
    return { kind: "insufficient", float: float + amount };
  }

  await redis.incrby(spentKey(profile), amount);
  return { kind: "recorded", float };
}

/**
 * Debit a profile's float for an in-feed tip. Tips never move Elo and carry
 * no daily cap — otherwise identical to the duel debit: atomic decrement
 * first, spend record second.
 */
export async function debitForTip(
  profile: string,
  amount: number,
  redis: Redis | null = getRedis(),
): Promise<DebitForTipResult> {
  if (invalidAmount(amount)) return { kind: "invalid" };
  if (!redis) return { kind: "unavailable" };

  const float = await redis.decrby(floatKey(profile), amount);
  if (float < 0) {
    await redis.incrby(floatKey(profile), amount);
    return { kind: "insufficient", float: float + amount };
  }

  await redis.incrby(spentKey(profile), amount);
  return { kind: "recorded", float };
}

/**
 * Accrue debited kudos to the receiving author's unsettled earnings — the
 * record half of a complete duel or tip, called only after its debit
 * reported `recorded`.
 */
export async function accrueEarned(
  handle: string,
  amount: number,
  redis: Redis | null = getRedis(),
): Promise<AccrueEarnedResult> {
  if (invalidAmount(amount)) return { kind: "invalid" };
  if (!redis) return { kind: "unavailable" };
  const earned = await redis.incrby(earnedKey(handle), amount);
  return { kind: "recorded", earned };
}

/**
 * Move settled kudos from a handle's accrual to its settled total — called
 * by the settlement sweep only after the on-chain payment is accepted.
 * Debit then record: the accrual is decremented before the settled total is
 * written, so a crash between the two can never leave the accrual intact to
 * be paid a second time on the next sweep. Settling more than has accrued
 * is refused and refunded.
 */
export async function markSettled(
  handle: string,
  amount: number,
  redis: Redis | null = getRedis(),
): Promise<MarkSettledResult> {
  if (invalidAmount(amount)) return { kind: "invalid" };
  if (!redis) return { kind: "unavailable" };

  const earned = await redis.decrby(earnedKey(handle), amount);
  if (earned < 0) {
    await redis.incrby(earnedKey(handle), amount);
    return { kind: "insufficient", earned: earned + amount };
  }

  const settled = await redis.incrby(settledKey(handle), amount);
  return { kind: "recorded", settled };
}

/** A profile's spendable balance. Null-Redis safe: zero. */
export async function readFloat(
  profile: string,
  redis: Redis | null = getRedis(),
): Promise<number> {
  if (!redis) return 0;
  return (await redis.get<number>(floatKey(profile))) ?? 0;
}

/** A profile's giver-side books. Null-Redis safe: zeroed. */
export async function readProfileAccount(
  profile: string,
  redis: Redis | null = getRedis(),
): Promise<ProfileAccount> {
  if (!redis) return { funded: 0, float: 0, spent: 0 };
  const [funded, float, spent] = await Promise.all([
    redis.get<number>(fundedKey(profile)),
    redis.get<number>(floatKey(profile)),
    redis.get<number>(spentKey(profile)),
  ]);
  return { funded: funded ?? 0, float: float ?? 0, spent: spent ?? 0 };
}

/** A handle's receiver-side books. Null-Redis safe: zeroed. */
export async function readHandleAccount(
  handle: string,
  redis: Redis | null = getRedis(),
): Promise<HandleAccount> {
  if (!redis) return { earned: 0, settled: 0 };
  const [earned, settled] = await Promise.all([
    redis.get<number>(earnedKey(handle)),
    redis.get<number>(settledKey(handle)),
  ]);
  return { earned: earned ?? 0, settled: settled ?? 0 };
}
