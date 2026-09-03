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

/**
 * The score a link enters the board at, and carries for life — kudos add
 * whole numbers on top of it.
 *
 * Redis breaks an equal-score tie by comparing MEMBER strings: ascending
 * bytewise under ZRANGE, and `rev` reverses that comparison too. `profile:`
 * begins 0x70, `link:` 0x6c — so with every entry at score zero the reversed
 * order put the ENTIRE seeded directory ahead of every link, and a paid link
 * was born beneath it (invisible outright once the directory outgrew
 * boardTop's window).
 *
 * Half a kudos defeats that tie-break BETWEEN THE TWO FAMILIES rather than
 * only at the floor: link scores are whole kudos plus a half, profile scores
 * are whole kudos, so a link and a profile can never hold the same score. At
 * equal kudos the link — which paid to be on the board — edges the profile; a
 * profile with one more kudos still outranks it, so the board remains exactly
 * the kudos ranking the spec asks for (Decision 1).
 *
 * WITHIN the profile family the lexicographic rule very much still runs, and
 * an earlier version of this comment wrongly said it "never runs at all".
 * Every profile seeds at zero, so until kudos move them the directory's order
 * under `rev` is reverse-alphabetical by handle. Accepted, with the bound
 * stated rather than implied: the order among zero-kudos profiles is
 * arbitrary but stable, and nobody is hidden by it — the front page reads the
 * same number of handles as board members and appends any the board omits
 * (withUnlistedHandles), so a profile cut from the window still renders. The
 * one repair that would remove the tie — seeding a fractional recency value —
 * is exactly what LINK_SCORE_OFFSET needs the profile side to stay clear of,
 * so it would trade a cosmetic ordering for a real collision.
 *
 * The offset rides the LINK side because a link has exactly one creation
 * door (addLinkToBoard) while a profile card has two (the directory seed and
 * a bare zincrby from the kudos path) — the invariant is total where it can
 * only be written in one place. mergeBoard subtracts it again for display,
 * so no card ever shows half a kudos.
 */
export const LINK_SCORE_OFFSET = 0.5;

/** The board member a link txid ranks under. */
export const linkMember = (txid: string): string => `link:${txid}`;

/** The board member an archived profile ranks under — one card per profile. */
export const profileMember = (handle: string): string => `profile:${handle.toLowerCase()}`;

/** What a link write did: put the target on the board, found it already
 * there, or could not reach the store to find out. */
export type AddLinkResult = "listed" | "already-listed" | "unavailable";

/**
 * Land a freshly-inscribed link on the board: cache its validated record,
 * enter it at score zero, and stamp the log with the insertion time. Every
 * write is `nx`-guarded or idempotent, so a retry after a partial failure
 * never resets a kudos total or re-stamps the log.
 *
 * The board write is the one that answers (specification, Decision 3: one
 * row per target): a second stamp for a listed target reads `already-listed`
 * while the cache and the log — both `nx` — stay exactly as the first stamp
 * left them. A replay after a partial failure still lands whatever it
 * missed, so `already-listed` is a verdict on the target, never a refusal
 * to repair.
 */
export async function addLinkToBoard(
  txid: string,
  record: FolkloreRecord,
  nowMs: number,
  redis: Redis | null = getRedis(),
): Promise<AddLinkResult> {
  if (!redis) return "unavailable";
  const target = record.kind === "link" && record.txid ? record.txid : txid;
  // nx, like the two zadds beside it: the first successful stamp owns the
  // row, and a second stamp for the same target can never replace the cached
  // title or the kudos earner (specification, Decision 3).
  await redis.set(linkKey(target), record, { nx: true });
  const added = await redis.zadd(BOARD_KEY, { nx: true }, {
    score: LINK_SCORE_OFFSET,
    member: linkMember(target),
  });
  await redis.zadd(LOG_KEY, { nx: true }, { score: nowMs, member: target });
  return (added ?? 0) > 0 ? "listed" : "already-listed";
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

/** True when a txid ranks on the board as a link — the kudos bump's
 * classifier. A profile card can never collide: the member encodings differ
 * by prefix. Null-Redis safe: false. */
export async function isBoardLink(
  txid: string,
  redis: Redis | null = getRedis(),
): Promise<boolean> {
  if (!redis) return false;
  return (await redis.zscore(BOARD_KEY, linkMember(txid))) !== null;
}

/** Seed a profile card at a starting score — `nx`-guarded, so re-seeding
 * never resets a total that kudos have since moved. Null-Redis safe. */
export async function seedProfileOnBoard(
  handle: string,
  score: number,
  redis: Redis | null = getRedis(),
): Promise<boolean> {
  if (!redis) return false;
  const added = await redis.zadd(BOARD_KEY, { nx: true }, {
    score,
    member: profileMember(handle),
  });
  return (added ?? 0) > 0;
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

/**
 * The cached validated record for a board link.
 *
 * Three answers, not two: a record, a genuine absence (never cached, or
 * delisted — the moderation lever removes the cache and the board entry),
 * and a store we cannot reach. Collapsing the last two into `null` made an
 * outage indistinguishable from "no such parent", so a caller had to answer
 * a well-behaved client "that parent does not exist, do not retry" while the
 * truth was "ask again in a moment". The distinction is the caller's to
 * relay; this function's job is only to stop losing it.
 */
export type LinkRecordRead =
  | { kind: "record"; record: FolkloreRecord }
  | { kind: "absent" }
  | { kind: "unavailable" };

export async function readLinkRecord(
  txid: string,
  redis: Redis | null = getRedis(),
): Promise<LinkRecordRead> {
  if (!redis) return { kind: "unavailable" };
  const record = await redis.get<FolkloreRecord>(linkKey(txid));
  return record ? { kind: "record", record } : { kind: "absent" };
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
