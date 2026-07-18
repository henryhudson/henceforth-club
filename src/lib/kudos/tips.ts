import type { Redis } from "@upstash/redis";
import { dateKey, getRedis } from "../redis";
import { TIP_PRIORITY_FLOOR, TIP_PRIORITY_HALF_LIFE_DAYS } from "./constants";
import { accrueEarned, debitForTip } from "./float";

// The tip path — in-feed kudos on any text as you browse. A tip is four
// movements and nothing else:
//
//   float debit        the giver's money out (float.ts, debit then record)
//   kudos:tips:<postId>     the public count ticks — a tally, never decayed
//   earned accrual     the author's money in (float.ts)
//   kudos:priority:<postId> the decaying dealer-priority bump
//
// Tips never move Elo — a proper Elo cannot ingest single-sided applause —
// so this module imports nothing from elo.ts or ledger.ts and touches none
// of their keys; the no-Elo-write test watches the whole Redis footprint to
// hold that line. What a tip buys instead is exposure: the priority bump
// raises the text's odds of being dealt, and it must then win its duels on
// merit. Priority halves every TIP_PRIORITY_HALF_LIFE_DAYS and reads as
// zero below TIP_PRIORITY_FLOOR. Null-Redis safe like the rest of kudos.

const tipCountKey = (postId: string) => `kudos:tips:${postId}`;
const priorityKey = (postId: string) => `kudos:priority:${postId}`;

const MS_PER_DAY = 86_400_000;

/** A post's standing priority as stored: the value as of the day it was
 * last bumped. Decay happens on read, so time stays a parameter. */
export type TipPriorityRecord = { value: number; day: string };

export type RecordTipResult =
  | { kind: "recorded"; float: number; tipped: number; priority: number }
  | { kind: "insufficient"; float: number }
  | { kind: "invalid" }
  | { kind: "unavailable" };

/**
 * The stored priority as of `asOfDay` — pure exponential decay with a
 * half-life, floored to exactly zero below TIP_PRIORITY_FLOOR. Total: an
 * unreadable day on either side reads as zero (no exposure beats NaN in the
 * dealer's weights), and a record dated in the future decays as if bumped
 * today — clock skew never grows a priority.
 */
export function decayedPriority(record: TipPriorityRecord, asOfDay: string): number {
  const days = (Date.parse(asOfDay) - Date.parse(record.day)) / MS_PER_DAY;
  if (Number.isNaN(days)) return 0;
  const decayed = record.value * 2 ** (-Math.max(0, days) / TIP_PRIORITY_HALF_LIFE_DAYS);
  return decayed < TIP_PRIORITY_FLOOR ? 0 : decayed;
}

/**
 * Record an in-feed tip: debit the giver's float, tick the post's public
 * count, accrue the amount to the author, and bump the post's dealer
 * priority (the standing value decayed to today, plus the amount). The
 * debit goes first, per the float module's debit-then-record contract — a
 * failed debit returns as it is and touches nothing else, and a crash after
 * it can only lose records, never money. The priority bump is a plain
 * read-modify-write: a lost race there costs a little exposure, never a
 * kudos.
 */
export async function recordTip(
  profile: string,
  postId: string,
  author: string,
  amount: number,
  day: string = dateKey(),
  redis: Redis | null = getRedis(),
): Promise<RecordTipResult> {
  if (!redis) return { kind: "unavailable" };
  const debit = await debitForTip(profile, amount, redis);
  if (debit.kind !== "recorded") return debit;

  const tipped = await redis.incrby(tipCountKey(postId), amount);
  await accrueEarned(author, amount, redis);

  const standing = await redis.get<TipPriorityRecord>(priorityKey(postId));
  const priority = (standing ? decayedPriority(standing, day) : 0) + amount;
  await redis.set(priorityKey(postId), { value: priority, day });

  return { kind: "recorded", float: debit.float, tipped, priority };
}

/** A post's public tip count — the tally that ticks under the kudos
 * control. Null-Redis safe: zero. */
export async function readTipCount(
  postId: string,
  redis: Redis | null = getRedis(),
): Promise<number> {
  if (!redis) return 0;
  return (await redis.get<number>(tipCountKey(postId))) ?? 0;
}

/** A post's dealer priority as of `asOfDay`, decayed on read — what the
 * dealer feeds its tip-priority draw. Null-Redis safe: zero. */
export async function readTipPriority(
  postId: string,
  asOfDay: string = dateKey(),
  redis: Redis | null = getRedis(),
): Promise<number> {
  if (!redis) return 0;
  const standing = await redis.get<TipPriorityRecord>(priorityKey(postId));
  return standing ? decayedPriority(standing, asOfDay) : 0;
}
