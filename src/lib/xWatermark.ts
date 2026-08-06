import { getRedis } from "./redis";
import { parseBindingAddress } from "./xBinding";
import { archivedTweetIds, type ArchivedSets } from "./xArchived";

/**
 * The per-handle completeness watermark — the ONLY thing that may bound a paid
 * timeline read (2026-08-06, replacing the parked folklore-since-id-blocked
 * design the adversarial review refused).
 *
 * The refuted axiom was that max(archived tweet id) marks completeness. It does
 * not: archives are sparse by construction — a default read archives only the
 * newest ~100 posts — so bounding there silently strands everything between the
 * old sparse coverage and the new head. Completeness is therefore recorded as
 * EXPLICIT DATA, never inferred: a watermark is written only when an unbounded
 * full read EXHAUSTED the timeline (X ran out of `next_token` before the page
 * budget ran out), and it records exactly what that read delivered. A read that
 * stopped short — page budget hit, or a page failed mid-walk — records nothing
 * and can never masquerade as complete.
 *
 * Consuming the watermark is guarded three ways, each refusing toward the full
 * (expensive but correct) read:
 *
 * 1. COVERAGE — every post the watermarked read delivered must now be ON CHAIN
 *    (`tweetIds ⊆ archived`). Delivery is not inscription: if the app that
 *    bought the exhaustive read never inscribed it, bounding would hide the
 *    back-catalogue forever while a full read still healed it. So the bound
 *    waits until the chain has caught up with what was delivered.
 * 2. REWARD ROUTING — the shipped app derives the reward payee by scanning the
 *    FETCHED timeline for the account's binding tweet (xtextWord.swift
 *    rewardPayeeAddress). A bounded response omits every post at or below the
 *    watermark, so if a binding line sits down there the app would misroute the
 *    reward to the developer address. A watermark that saw a binding line
 *    refuses to bound until the app stops deriving the payee from the fetched
 *    timeline. (A binding posted LATER is newer than the watermark, is fetched
 *    by the bounded read, and advances into the record — so the guard survives
 *    watermark advancement.)
 * 3. MEDIA BACKFILL — a post archived text-only can have its photos inscribed
 *    later, and the refs only ride a read that returns the post. Posts the
 *    watermarked read saw carrying media must have their media on chain
 *    (`mediaPostIds ⊆ archived media`) before the bound may hide them.
 *
 * A bounded read that itself exhausts X's remainder ADVANCES the watermark by
 * union — completeness then extends to the new head, and the coverage guard
 * keeps the bound off until the delta is inscribed. A bounded read ended by the
 * page budget advances nothing, so any truncation hole is re-fetched by the
 * next read: the self-healing property of the unbounded read is preserved.
 */
export type XWatermark = {
  v: 1;
  /** Every id at or below this is covered by the record below. */
  completeThroughId: string;
  /** Every post id the exhausting read(s) delivered. */
  tweetIds: string[];
  /** The delivered post ids that carried media references. */
  mediaPostIds: string[];
  /** The address of a binding line seen in the delivered posts, or null. */
  bindingAddress: string | null;
  recordedAt: string;
};

/**
 * The newest tweet id, taken numerically. Snowflake ids grow with time but not
 * in length-lockstep, so a lexicographic max would call "999" newer than
 * "10000" — and real ids sit past 2^53, where Number comparison lies too.
 * BigInt or nothing. A non-numeric id is skipped rather than thrown on: one
 * corrupt id must not brick every future archive.
 */
export function newestTweetId(tweetIds: Iterable<string>): string | null {
  let newest: bigint | null = null;
  let newestRaw: string | null = null;
  for (const id of tweetIds) {
    if (!/^\d+$/.test(id)) continue;
    const n = BigInt(id);
    if (newest === null || n > newest) {
      newest = n;
      newestRaw = id;
    }
  }
  return newestRaw;
}

/** What the watermark logic needs to know about a completed timeline read. */
export type CompletedRead = {
  /** The posts the read delivered, id and text (text feeds the binding scan). */
  posts: { id: string; text: string }[];
  /** Ids of delivered posts that carried media references. */
  mediaPostIds: string[];
  /** True only when X ran out of `next_token` before the page budget ran out. */
  exhausted: boolean;
  /** The bound the read ran under, if any. */
  sinceId?: string;
};

/**
 * Pure: the watermark a completed read justifies, or null when it justifies
 * none (in which case nothing is written and any prior record stands).
 *
 * - A read that did NOT exhaust the timeline never records and never advances —
 *   this is the sparse-archive-refuses-to-watermark rule, and it covers both
 *   the page-budget stop and a page that failed mid-walk.
 * - An UNBOUNDED exhausted read records fresh: it delivered the whole reachable
 *   timeline, so completeness through its newest id is a fact, not a guess.
 * - A BOUNDED exhausted read advances the prior record by union: everything at
 *   or below the old watermark was already covered, and the delta covers the
 *   rest up to the new head. A bound without a prior record cannot exist
 *   honestly, so it records nothing rather than invent completeness.
 * - An empty delivery changes no data, so it writes nothing.
 */
export function watermarkFromRead(
  read: CompletedRead,
  prior: XWatermark | null,
  at: Date = new Date(),
): XWatermark | null {
  if (!read.exhausted) return null;
  if (read.posts.length === 0) return null;

  const deliveredIds = read.posts.map((p) => p.id);
  const newest = newestTweetId(deliveredIds);
  if (newest === null) return null;

  if (read.sinceId === undefined) {
    return {
      v: 1,
      completeThroughId: newest,
      tweetIds: deliveredIds,
      mediaPostIds: read.mediaPostIds,
      bindingAddress: parseBindingAddress(read.posts),
      recordedAt: at.toISOString(),
    };
  }

  if (prior === null) return null;
  const completeThroughId =
    BigInt(newest) > BigInt(prior.completeThroughId) ? newest : prior.completeThroughId;
  return {
    v: 1,
    completeThroughId,
    tweetIds: [...new Set([...prior.tweetIds, ...deliveredIds])],
    mediaPostIds: [...new Set([...prior.mediaPostIds, ...read.mediaPostIds])],
    bindingAddress: parseBindingAddress(read.posts) ?? prior.bindingAddress,
    recordedAt: at.toISOString(),
  };
}

/**
 * Pure: the since bound a watermark supports against the chain's current
 * state, or null. Null is always safe — it means the full, unbounded read.
 * Every guard here refuses toward that full read; see the module comment for
 * why each exists. Malformed records (this is a Redis read, so the shape is a
 * hope, not a proof) refuse too.
 */
export function consumableSinceId(
  watermark: XWatermark | null,
  archived: ArchivedSets | null,
): string | null {
  if (watermark === null) return null;
  if (watermark.v !== 1) return null;
  if (typeof watermark.completeThroughId !== "string") return null;
  if (!/^\d+$/.test(watermark.completeThroughId)) return null;
  if (!Array.isArray(watermark.tweetIds) || !Array.isArray(watermark.mediaPostIds)) return null;
  // The reward-routing guard: a binding at or below the watermark must keep
  // being fetched, or the app pays the wrong party.
  if (watermark.bindingAddress) return null;
  // An unreadable index proves nothing about coverage. Full read.
  if (archived === null) return null;
  // The coverage guard: delivery is not inscription.
  for (const id of watermark.tweetIds) {
    if (!archived.tweetIds.has(id)) return null;
  }
  // The media-backfill guard.
  for (const id of watermark.mediaPostIds) {
    if (!archived.mediaPostIds.has(id)) return null;
  }
  return watermark.completeThroughId;
}

// Storage: the same Redis the archive pipeline already writes its records to
// (the handle index, the transaction digests, the owner bindings) — one more
// `x:`-prefixed key beside them. Rebuildable only by a fresh exhaustive read,
// so losing it costs money once, never data.

const key = (handle: string) => `x:watermark:${handle.toLowerCase()}`;

export async function getXWatermark(handle: string): Promise<XWatermark | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get<XWatermark>(key(handle))) ?? null;
}

export async function setXWatermark(handle: string, watermark: XWatermark): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(key(handle), watermark);
}

/**
 * The bound a paid full read may run under, resolved against live state: the
 * stored watermark weighed against what is actually on chain. The one function
 * BOTH /api/x/quote and /api/x/archive call, so the quoted price and the
 * demanded fee cannot derive from different bounds.
 *
 * The binding guard is checked before the chain union is fetched — when the
 * watermark already refuses on its own contents there is nothing to look up.
 *
 * A store or chain-index error refuses the bound rather than the READ: the
 * caller is holding a verified payment for an archive this machinery merely
 * discounts, so its failures must cost the expensive full read, never the
 * archive itself.
 */
export async function resolveReadBound(
  handle: string,
): Promise<{ watermark: XWatermark | null; sinceId: string | null }> {
  try {
    const watermark = await getXWatermark(handle);
    if (watermark === null) return { watermark: null, sinceId: null };
    if (watermark.bindingAddress) return { watermark, sinceId: null };
    const archived = await archivedTweetIds(handle);
    return { watermark, sinceId: consumableSinceId(watermark, archived) };
  } catch (error) {
    console.error(`x read bound resolution failed for ${handle}; reading unbounded`, error);
    return { watermark: null, sinceId: null };
  }
}

/**
 * Record or advance the handle's watermark from a completed read. Best-effort
 * by design: the caller has already served a paid read, so a storage failure
 * here must not turn that success into an error — the cost of a lost write is
 * only that the next read stays unbounded, which is the safe direction.
 */
export async function recordWatermark(
  handle: string,
  read: CompletedRead,
  prior: XWatermark | null,
): Promise<void> {
  try {
    const next = watermarkFromRead(read, prior);
    if (!next) return;
    await setXWatermark(handle, next);
  } catch (error) {
    console.error(`x watermark write failed for ${handle}`, error);
  }
}
