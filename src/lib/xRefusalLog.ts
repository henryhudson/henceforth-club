import type { Redis } from "@upstash/redis";
import { getRedis } from "./redis";

// Durable record of every refusal POST /api/x/register sends. Before this,
// a non-200 left NO trace on the server, so debugging a user's "my archive
// never appeared" report was blind. One capped global list, newest first —
// an operations breadcrumb trail, not a ledger: old entries fall off the end.
//
//   x:register:refusals   LPUSH + LTRIM, capped at REFUSAL_CAP
//
// Logging must never change the route's answer, so unlike the money-path
// modules this one swallows Redis failures: a refusal the log misses is a
// smaller loss than a refusal the log turns into a 500. Null-Redis safe
// like xVotes.ts.

const KEY = "x:register:refusals";
export const REFUSAL_CAP = 500;

export type RegisterRefusal = {
  at: number; // unix seconds
  handle: string; // "" when the request never yielded one (bad-json, bad-input)
  txid: string; // "" likewise
  reason: string;
  status: number;
};

/** Append a refusal, newest first, trimming to the cap. Never throws:
 * false means the record was not kept (Redis unconfigured or down). */
export async function logRefusal(
  refusal: RegisterRefusal,
  redis: Redis | null = getRedis(),
): Promise<boolean> {
  if (!redis) return false;
  try {
    await redis.lpush(KEY, refusal);
    await redis.ltrim(KEY, 0, REFUSAL_CAP - 1);
    return true;
  } catch {
    return false;
  }
}

/** The newest `count` refusals, newest first. Empty when nothing has been
 * refused — or when Redis is unconfigured or down. */
export async function readRefusals(
  count = 50,
  redis: Redis | null = getRedis(),
): Promise<RegisterRefusal[]> {
  if (!redis) return [];
  try {
    return await redis.lrange<RegisterRefusal>(KEY, 0, count - 1);
  } catch {
    return [];
  }
}
