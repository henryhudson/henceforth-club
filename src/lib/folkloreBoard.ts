import type { Redis } from "@upstash/redis";
import type { FolkloreRecord } from "@/app/folklore/linkRecord";
import { getRedis } from "./redis";

// The folklore board's Upstash index — an opinion about the chain, never
// custody of it (spec Decision 2). Three key families:
//
//   folklore:board            zset: link:<txid> / profile:<handle> -> kudos total
//   folklore:comments:<txid>  list: comment txids, oldest first
//   folklore:log              zset: txid -> index-INSERTION time in ms
//   folklore:link:<txid>      the validated record JSON — a read cache;
//                             the chain stays the truth
//
// The log's clock is when WE learned of a txid, never block time (spec
// Decision 3): a backfilled or late-indexed transaction must still reach
// every client whose watermark postdates its block. Writers are idempotent
// — a worker retry never resets a kudos score, re-stamps the log, or
// duplicates a comment. Null-Redis safe like the rest of the site's index
// modules: writers no-op, readers read empty.

const BOARD_KEY = "folklore:board";
const LOG_KEY = "folklore:log";
const commentsKey = (txid: string) => `folklore:comments:${txid}`;
const linkKey = (txid: string) => `folklore:link:${txid}`;

/** The board member a link txid ranks under. */
export const linkMember = (txid: string): string => `link:${txid}`;

/** The board member an archived profile ranks under — one card per profile. */
export const profileMember = (handle: string): string => `profile:${handle.toLowerCase()}`;

/**
 * Land a freshly-inscribed link on the board: cache its validated record,
 * enter it at score zero, and stamp the log with the insertion time. Every
 * write is `nx`-guarded or idempotent, so a retry after a partial failure
 * never resets a kudos total or re-stamps the log.
 */
export async function addLinkToBoard(
  txid: string,
  record: FolkloreRecord,
  nowMs: number,
  redis: Redis | null = getRedis(),
): Promise<boolean> {
  if (!redis) return false;
  await redis.set(linkKey(txid), record);
  await redis.zadd(BOARD_KEY, { nx: true }, { score: 0, member: linkMember(txid) });
  await redis.zadd(LOG_KEY, { nx: true }, { score: nowMs, member: txid });
  return true;
}

/**
 * Land a freshly-inscribed comment: append its txid to the parent's thread
 * (append-if-absent, the xIndex idiom — a retry never duplicates) and stamp
 * the log so the delta sync carries it.
 */
export async function addCommentToIndex(
  parent: string,
  txid: string,
  nowMs: number,
  redis: Redis | null = getRedis(),
): Promise<boolean> {
  if (!redis) return false;
  const existing = await redis.lrange<string>(commentsKey(parent), 0, -1);
  if (!existing.includes(txid)) await redis.rpush(commentsKey(parent), txid);
  await redis.zadd(LOG_KEY, { nx: true }, { score: nowMs, member: txid });
  return true;
}

/** Add kudos to a board member's total. Returns the new score, or null when
 * Redis isn't configured. */
export async function bumpBoardKudos(
  member: string,
  by: number,
  redis: Redis | null = getRedis(),
): Promise<number | null> {
  if (!redis) return null;
  return await redis.zincrby(BOARD_KEY, by, member);
}

/** The front page: the top `n` board members, highest kudos first. */
export async function boardTop(
  n: number,
  redis: Redis | null = getRedis(),
): Promise<{ member: string; score: number }[]> {
  if (!redis || n <= 0) return [];
  const rows = await redis.zrange<(string | number)[]>(BOARD_KEY, 0, n - 1, {
    rev: true,
    withScores: true,
  });
  const out: { member: string; score: number }[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    out.push({ member: String(rows[i]), score: Number(rows[i + 1]) });
  }
  return out;
}

/** A link's comment txids, oldest first — the list order IS submission order. */
export async function commentTxids(
  parent: string,
  redis: Redis | null = getRedis(),
): Promise<string[]> {
  if (!redis) return [];
  const txids = await redis.lrange<string>(commentsKey(parent), 0, -1);
  return txids.map(String);
}

/** How many comments a link carries — the feed card's count. */
export async function commentCount(
  parent: string,
  redis: Redis | null = getRedis(),
): Promise<number> {
  if (!redis) return 0;
  return await redis.llen(commentsKey(parent));
}

/** The cached validated record for a board link, or null when uncached (or
 * delisted — the moderation lever removes the cache and the board entry). */
export async function getLinkRecord(
  txid: string,
  redis: Redis | null = getRedis(),
): Promise<FolkloreRecord | null> {
  if (!redis) return null;
  return (await redis.get<FolkloreRecord>(linkKey(txid))) ?? null;
}

/**
 * The delta sync: every txid the index learned of at or since `sinceMs`,
 * oldest first, plus the server clock the client stores as its next
 * watermark. `now` is captured BEFORE the log read — a txid indexed
 * mid-read scores after the returned watermark and is re-delivered next
 * sync instead of falling into the gap. The boundary read is inclusive for
 * the same reason; the client's set-union merge dedupes (spec: merge is
 * idempotent).
 */
export async function indexSince(
  sinceMs: number,
  redis: Redis | null = getRedis(),
  nowFn: () => number = Date.now,
): Promise<{ txids: string[]; now: number }> {
  const now = nowFn();
  if (!redis) return { txids: [], now };
  const txids = await redis.zrange<string[]>(LOG_KEY, sinceMs, "+inf", { byScore: true });
  return { txids: txids.map(String), now };
}
