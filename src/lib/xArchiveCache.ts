import { cache } from "react";
import type { Redis } from "@upstash/redis";
import { getRedis } from "./redis";
import { getXTxids } from "./xIndex";
import { fetchTxArchiveWithTime as fetchTxArchiveDefault } from "./whatsonchain";
import { stitchToXArchive, resolveMediaKinds, type SocialArchive } from "@/app/text/onchain";
import { dedupePosts, type XArchive, type XPost, type XProfile } from "@/app/text/parseArchive";

// Reading a handle's whole archive used to mean stitching every archive
// transaction and shipping every post in one response — fine at a few dozen
// posts, a multi-megabyte download at a few thousand. This module chunks the
// stitched archive into ~100-post pages in Redis, so a page read only ever
// costs the chunks it actually needs. An archive transaction set is
// immutable, so a chunk is cached forever until a new delta transaction
// changes the set — detected by hashing the ordered txid list.

/** Posts per cached chunk. Chunk `n` holds stitched posts `[n*CHUNK_SIZE, (n+1)*CHUNK_SIZE)`. */
export const CHUNK_SIZE = 100;

/** Posts per page: the profile page's first server render and the paged route both use this. */
export const PAGE_SIZE = 30;

// Bumped whenever the cached shape gains fields older cached chunks don't
// carry — a v1 (or version-less) cache is treated as stale even when its
// txid set hash still matches, so it rebuilds instead of serving posts that
// are missing `txid`.
// 3: media entries carry their real kind (photo|video), resolved from ORDFS.
const META_VERSION = 3;

type ArchiveMeta = {
  v: typeof META_VERSION;
  txidSetHash: string;
  postCount: number;
  chunkCount: number;
  profile: XProfile;
  latestTxid: string | null;
  generatedAt: string;
  txCount: number;
  photoCount: number;
  firstInscribedAt?: number;
  txTimes: Record<string, number>;
};

export type ArchivePage = {
  posts: XPost[];
  postCount: number;
  profile: XProfile;
  latestTxid: string | null;
  txCount?: number;
  photoCount?: number;
  firstInscribedAt?: number;
  txTimes: Record<string, number>;
};

const metaKey = (handle: string) => `x:posts:${handle.toLowerCase()}:meta`;
const chunkKey = (handle: string, n: number) => `x:posts:${handle.toLowerCase()}:${n}`;
const childrenKeyOf = (handle: string) => `x:posts:${handle.toLowerCase()}:children`;

/** Split posts (already newest-first) into fixed-size chunks ready to cache. */
export function chunkPosts(posts: XPost[]): XPost[][] {
  const chunks: XPost[][] = [];
  for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
    chunks.push(posts.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

/**
 * A stable hash of an ordered txid list, used to notice when a handle's
 * on-chain archive has grown (a new delta transaction was registered) and the
 * cached chunks need rebuilding. Order-sensitive on purpose: the txids are
 * always read oldest-first, so a genuinely different order would mean the
 * index itself changed underneath us. Plain FNV-1a over the joined ids — no
 * cryptographic property is needed, only that the same input always gives
 * the same output.
 */
export function txidSetHash(txids: string[]): string {
  const input = txids.join(",");
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Reply id -> the ids of posts that reply to it. Stored now for Task 7's
 * thread rendering; nothing reads this map yet in this task. */
export function childrenMap(posts: XPost[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const p of posts) {
    if (!p.replyToId) continue;
    (map[p.replyToId] ??= []).push(p.id);
  }
  return map;
}

/** Clamp an `[offset, offset+limit)` window to a total length, so an offset
 * past the end (or a negative one) yields an empty range instead of an
 * out-of-bounds slice. Total function: never throws, whatever the inputs. */
export function slicePage(
  total: number,
  offset: number,
  limit: number,
): { start: number; end: number } {
  const start = Math.min(Math.max(offset, 0), total);
  const end = Math.min(start + Math.max(limit, 0), total);
  return { start, end };
}

/** What one page read resolves a handle to, before slicing: either an
 * on-chain archive whose cache is still valid (read chunks from Redis), or
 * one just freshly stitched and rewritten (or, with no Redis available, held
 * only in memory for this request). */
type Resolved =
  | { kind: "cached"; meta: ArchiveMeta; redis: Redis; txids: string[]; hash: string }
  | { kind: "fresh"; archive: XArchive; meta: ArchiveMeta };

/** Count photo-type media items across a post list — the profile header's
 * permanence line reports how many photos the archive actually carries. */
export function countPhotos(posts: XPost[]): number {
  return posts.reduce((n, p) => n + (p.media?.filter((m) => m.type === "photo").length ?? 0), 0);
}

/** The earliest of a set of known transaction times, or undefined when none
 * are known (every archive transaction is still unconfirmed). */
export function earliestKnownTime(txTimes: Record<string, number>): number | undefined {
  const times = Object.values(txTimes);
  return times.length > 0 ? Math.min(...times) : undefined;
}

function freshMeta(
  archive: XArchive,
  hash: string,
  latestTxid: string,
  txCount: number,
  txTimes: Record<string, number>,
): ArchiveMeta {
  return {
    v: META_VERSION,
    txidSetHash: hash,
    postCount: archive.posts.length,
    chunkCount: chunkPosts(archive.posts).length,
    profile: archive.profile,
    latestTxid,
    generatedAt: new Date().toISOString(),
    txCount,
    photoCount: countPhotos(archive.posts),
    firstInscribedAt: earliestKnownTime(txTimes),
    txTimes,
  };
}

/** Fetch every indexed transaction for a handle and stitch + deduplicate them
 * into one chronological post list, ready to chunk and cache, along with how
 * many transactions contributed and which of their confirmation times are
 * known. Null when none of the transactions could be read (chain fetch down,
 * or a bad txid). `includeTimes` is false when there's no Redis to cache the
 * result in — a time lookup nobody can reuse would just double the number of
 * WhatsOnChain round trips on every single page view, so it's skipped
 * entirely; the outpoint chip and permanence line already have tested
 * fallbacks for an unknown time. */
async function stitchFresh(
  txids: string[],
  fetchTxArchive: typeof fetchTxArchiveDefault,
  includeTimes: boolean,
): Promise<
  { archive: XArchive; latestTxid: string; txCount: number; txTimes: Record<string, number> } | null
> {
  const fetched = await Promise.all(
    txids.map(async (txid) => ({ result: await fetchTxArchive(txid, undefined, includeTimes), txid })),
  );
  const pairs: Array<{ archive: SocialArchive; txid: string }> = [];
  const txTimes: Record<string, number> = {};
  for (const { result, txid } of fetched) {
    if (!result) continue;
    pairs.push({ archive: result.archive, txid });
    if (result.time !== undefined) txTimes[txid] = result.time;
  }
  if (pairs.length === 0) return null;
  const stitched = stitchToXArchive(pairs);
  // The archive JSON records vouts, not media types — ORDFS is the only source
  // of truth for what an inscription IS. Asked once, here, on rebuild only.
  const typed = await resolveMediaKinds({ ...stitched, posts: dedupePosts(stitched.posts) });
  return {
    archive: { profile: typed.profile, posts: typed.posts },
    latestTxid: pairs[pairs.length - 1].txid,
    txCount: pairs.length,
    txTimes,
  };
}

/** Write a freshly-stitched archive's chunks, meta, and children map to
 * Redis, replacing whatever (stale or absent) cache was there before. Meta
 * is written LAST, and only once every chunk and the children map have
 * actually landed — meta is the commit point a read trusts, so a request
 * that finds a valid meta can trust the chunks it points at are there too.
 * Throws (rather than swallowing) if any write fails, leaving meta
 * unwritten; see `attemptRebuild` for how a caller recovers from that. */
async function rebuildCache(
  handle: string,
  archive: XArchive,
  hash: string,
  latestTxid: string,
  txCount: number,
  txTimes: Record<string, number>,
  redis: Redis,
): Promise<ArchiveMeta> {
  const meta = freshMeta(archive, hash, latestTxid, txCount, txTimes);
  const chunks = chunkPosts(archive.posts);
  await Promise.all([
    ...chunks.map((chunk, n) => redis.set(chunkKey(handle, n), chunk)),
    redis.set(childrenKeyOf(handle), childrenMap(archive.posts)),
  ]);
  await redis.set(metaKey(handle), meta);
  return meta;
}

/** Rebuild the cache for a freshly-stitched archive, but never let a write
 * failure fail the request that triggered it: the caller already has a
 * correct in-memory stitch to serve regardless of whether the cache write
 * succeeds. A failed rebuild simply leaves the old (stale or absent) meta
 * in place, which the next read sees as a miss and retries on its own. */
async function attemptRebuild(
  handle: string,
  archive: XArchive,
  hash: string,
  latestTxid: string,
  txCount: number,
  txTimes: Record<string, number>,
  redis: Redis,
): Promise<ArchiveMeta> {
  try {
    return await rebuildCache(handle, archive, hash, latestTxid, txCount, txTimes, redis);
  } catch {
    return freshMeta(archive, hash, latestTxid, txCount, txTimes);
  }
}

/** Stitch a fresh archive from the chain and, when Redis is available,
 * rewrite the cache (a write failure never surfaces here — see
 * `attemptRebuild`). Null when every transaction fetch failed. */
async function stitchAndCache(
  handle: string,
  txids: string[],
  hash: string,
  fetchTxArchive: typeof fetchTxArchiveDefault,
  redis: Redis | null,
): Promise<{ archive: XArchive; meta: ArchiveMeta } | null> {
  const fresh = await stitchFresh(txids, fetchTxArchive, redis !== null);
  if (!fresh) return null;
  const meta = redis
    ? await attemptRebuild(handle, fresh.archive, hash, fresh.latestTxid, fresh.txCount, fresh.txTimes, redis)
    : freshMeta(fresh.archive, hash, fresh.latestTxid, fresh.txCount, fresh.txTimes);
  return { archive: fresh.archive, meta };
}

/** Resolve a handle to its archive: the cache when it's still valid for the
 * current txid set, or a freshly-stitched (and, when Redis is available,
 * rewritten) one otherwise. Null when the handle has no indexed transactions,
 * or every one of them fails to fetch — there is nothing to fall back to.
 * Wrapped in React's `cache()` so one request resolves a handle at most
 * once: the permalink route calls this (via `getArchivePost` and
 * `getArchivePage`) from both `generateMetadata` and the page body, which
 * would otherwise repeat the same chain lookup and cache read up to three
 * times over for a single page view. Outside of a request/render (as in
 * this module's unit tests), `cache()` has nothing to scope memoization to
 * and simply calls straight through — every call still runs. */
const resolveHandle = cache(async function resolveHandle(
  handle: string,
  fetchTxArchive: typeof fetchTxArchiveDefault,
  redis: Redis | null,
): Promise<Resolved | null> {
  const txids = await getXTxids(handle);
  if (txids.length === 0) return null;

  const hash = txidSetHash(txids);
  if (redis) {
    const cachedMeta = await redis.get<ArchiveMeta>(metaKey(handle));
    if (cachedMeta && cachedMeta.v === META_VERSION && cachedMeta.txidSetHash === hash) {
      return { kind: "cached", meta: cachedMeta, redis, txids, hash };
    }
  }

  const stitched = await stitchAndCache(handle, txids, hash, fetchTxArchive, redis);
  if (!stitched) return null; // every per-transaction fetch failed
  return { kind: "fresh", archive: stitched.archive, meta: stitched.meta };
});

/** Read only the chunks a `[start, end)` post window touches, and slice out
 * exactly that window — never the whole cached archive. Null means at least
 * one of the needed chunks is missing (evicted, or never written despite a
 * valid meta) — a genuine cache miss the caller must not paper over by
 * treating the hole as "no posts there"; that would silently shift every
 * post after the gap by however many posts the missing chunk held. */
async function readChunkRange(
  handle: string,
  start: number,
  end: number,
  redis: Redis,
): Promise<XPost[] | null> {
  if (start >= end) return [];
  const firstChunk = Math.floor(start / CHUNK_SIZE);
  const lastChunk = Math.floor((end - 1) / CHUNK_SIZE);
  const indices = Array.from({ length: lastChunk - firstChunk + 1 }, (_, i) => firstChunk + i);
  const chunks = await Promise.all(indices.map((n) => redis.get<XPost[]>(chunkKey(handle, n))));
  if (chunks.some((chunk) => chunk === null)) return null;
  const posts = (chunks as XPost[][]).flat();
  const chunkStart = firstChunk * CHUNK_SIZE;
  return posts.slice(start - chunkStart, end - chunkStart);
}

/** Scan cached chunks in order for a post id, stopping as soon as it's found.
 * A permalink read is rare next to the scroll-loader's sequential paging, so
 * a plain scan (rather than a second id -> chunk index map) keeps this
 * module's cached state to exactly what today's task needs. */
async function scanChunksForPost(
  handle: string,
  chunkCount: number,
  postId: string,
  redis: Redis,
): Promise<XPost | null> {
  for (let n = 0; n < chunkCount; n++) {
    const chunk = await redis.get<XPost[]>(chunkKey(handle, n));
    const found = chunk?.find((p) => p.id === postId);
    if (found) return found;
  }
  return null;
}

/**
 * One page of a handle's archive: `limit` posts starting at `offset`, plus
 * the profile, the total post count, and the latest archive txid (null for a
 * preview). Null when the handle has no on-chain archive and no preview.
 */
export async function getArchivePage(
  handle: string,
  offset: number,
  limit: number,
  fetchTxArchive: typeof fetchTxArchiveDefault = fetchTxArchiveDefault,
  redis: Redis | null = getRedis(),
): Promise<ArchivePage | null> {
  const resolved = await resolveHandle(handle, fetchTxArchive, redis);
  if (!resolved) return null;

  if (resolved.kind === "cached") {
    const { start, end } = slicePage(resolved.meta.postCount, offset, limit);
    const posts = await readChunkRange(handle, start, end, resolved.redis);
    if (posts !== null) {
      return { posts, ...pageInfoFromMeta(resolved.meta) };
    }
    // The meta says these chunks exist, but one is missing — an interrupted
    // rebuild, or an evicted key. Don't serve a hole or a shifted slice:
    // re-stitch fresh from the chain for this request, and try to repair
    // the cache so a later read doesn't hit the same gap.
    const repaired = await stitchAndCache(handle, resolved.txids, resolved.hash, fetchTxArchive, resolved.redis);
    if (!repaired) {
      // Every transaction fetch failed on the repair attempt too — nothing
      // fresh to serve. An empty page beats a misaligned one.
      return { posts: [], ...pageInfoFromMeta(resolved.meta) };
    }
    const repairedRange = slicePage(repaired.meta.postCount, offset, limit);
    return {
      posts: repaired.archive.posts.slice(repairedRange.start, repairedRange.end),
      ...pageInfoFromMeta(repaired.meta),
    };
  }

  // Only "fresh" remains once "cached" is handled above.
  const { start, end } = slicePage(resolved.meta.postCount, offset, limit);
  return { posts: resolved.archive.posts.slice(start, end), ...pageInfoFromMeta(resolved.meta) };
}

function pageInfoFromMeta(meta: ArchiveMeta): Omit<ArchivePage, "posts"> {
  return {
    postCount: meta.postCount,
    profile: meta.profile,
    latestTxid: meta.latestTxid,
    txCount: meta.txCount,
    photoCount: meta.photoCount,
    firstInscribedAt: meta.firstInscribedAt,
    txTimes: meta.txTimes,
  };
}

/** A single post by id, for the permalink page. Null when the handle has no
 * archive at all, or the archive doesn't contain that post id. */
export async function getArchivePost(
  handle: string,
  postId: string,
  fetchTxArchive: typeof fetchTxArchiveDefault = fetchTxArchiveDefault,
  redis: Redis | null = getRedis(),
): Promise<XPost | null> {
  const resolved = await resolveHandle(handle, fetchTxArchive, redis);
  if (!resolved) return null;

  if (resolved.kind === "cached") {
    return scanChunksForPost(handle, resolved.meta.chunkCount, postId, resolved.redis);
  }
  return resolved.archive.posts.find((p) => p.id === postId) ?? null;
}
