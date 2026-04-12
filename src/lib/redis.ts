import { Redis } from "@upstash/redis";

/**
 * Lazily-initialised Redis client.
 * Returns null if env vars aren't set — callers must handle the null case.
 */
let cached: Redis | null = null;

export function getRedis(): Redis | null {
  if (cached) return cached;
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  cached = new Redis({ url, token });
  return cached;
}

/** Format a Date as YYYY-MM-DD in UTC */
export function dateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
