import type { Redis } from "@upstash/redis";
import { getRedis } from "../redis";

// The Top chart's input: an append-only, day-keyed stream of every kudos a
// post receives — duel kudos to the crowned winner, tips wherever they land.
// One key per day:
//
//   kudos:received:<day>   the day's entries, oldest first
//
// The chart is a fold over one day's entries, so a correction is a replay
// (strike the entries, fold again) — never a patch to a cached number, per
// the plan's replay-ability requirement. Existing keys are untouched: this
// stream mirrors the earned accruals with the postId attached, it never
// replaces them. Null-Redis safe like the rest of kudos; a failed append
// can only lose a chart record, never money.

const receivedKey = (day: string) => `kudos:received:${day}`;

/** One kudos landing on a post: which text, whose archive, how much, and by
 * which gesture. The day lives in the key, not the entry. */
export type ReceivedKudos = {
  postId: string;
  author: string;
  amount: number;
  kind: "duel" | "tip";
};

export type RecordKudosReceivedResult = "recorded" | "unavailable";

/** Append one received kudos to its day's stream. */
export async function recordKudosReceived(
  day: string,
  received: ReceivedKudos,
  redis: Redis | null = getRedis(),
): Promise<RecordKudosReceivedResult> {
  if (!redis) return "unavailable";
  await redis.rpush(receivedKey(day), received);
  return "recorded";
}

/** A day's received kudos, oldest first — the chart's whole input. Empty
 * when nothing landed that day, or without Redis. */
export async function readKudosReceived(
  day: string,
  redis: Redis | null = getRedis(),
): Promise<ReceivedKudos[]> {
  if (!redis) return [];
  return redis.lrange<ReceivedKudos>(receivedKey(day), 0, -1);
}
