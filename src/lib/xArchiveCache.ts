import type { Redis } from "@upstash/redis";
import { getRedis } from "./redis";
import { getXTxids } from "./xIndex";
import { fetchTxArchiveWithTime as fetchTxArchiveDefault } from "./whatsonchain";
import { stitchToXArchive, type SocialArchive } from "@/app/x/onchain";
import { realArchive } from "@/app/x/real";
import type { XArchive, XPost, XProfile } from "@/app/x/parseArchive";

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
const META_VERSION = 2;

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

// Pre-inscription fallbacks (live preview rendered until a handle is indexed
// on-chain). Once a profile is inscribed and registered, the on-chain read
// wins. These are never written to Redis — a preview mirrors X live, so
// caching it would go stale the moment the real profile posts again.
const previewArchives: Record<string, XArchive> = { henryhudson6: realArchive };

const metaKey = (handle: string) => `x:posts:${handle.toLowerCase()}:meta`;
const chunkKey = (handle: string, n: number) => `x:posts:${handle.toLowerCase()}:${n}`;
const childrenKeyOf = (handle: string) => `x:posts:${handle.toLowerCase()}:children`;

/**
 * Drop a duplicate post by trimmed text, keeping the first occurrence. Posts
 * arrive newest-first, so the kept copy is always the newest one. Doing this
 * once, here, before chunking, is what keeps a page offset meaning the same
 * thing every time it's read — the old approach re-deduplicated on every
 * render, which would silently shift indices as soon as reads were paged.
 */
export function dedupePosts(posts: XPost[]): XPost[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    const key = p.text.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

/** What one page read resolves a handle to, before slicing: either a preview
 * (never cached), an on-chain archive whose cache is still valid (read
 * chunks from Redis), or one just freshly stitched and rewritten (or, with
 * no Redis available, held only in memory for this request). */
type Resolved =
  | { kind: "preview"; archive: XArchive }
  | { kind: "cached"; meta: ArchiveMeta; redis: Redis }
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
 * or a bad txid). */
async function stitchFresh(
  txids: string[],
  fetchTxArchive: typeof fetchTxArchiveDefault,
): Promise<
  { archive: XArchive; latestTxid: string; txCount: number; txTimes: Record<string, number> } | null
> {
  const fetched = await Promise.all(
    txids.map(async (txid) => ({ result: await fetchTxArchive(txid), txid })),
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
  return {
    archive: { profile: stitched.profile, posts: dedupePosts(stitched.posts) },
    latestTxid: pairs[pairs.length - 1].txid,
    txCount: pairs.length,
    txTimes,
  };
}

/** Write a freshly-stitched archive's chunks, meta, and children map to
 * Redis, replacing whatever (stale or absent) cache was there before. */
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
    redis.set(metaKey(handle), meta),
    redis.set(childrenKeyOf(handle), childrenMap(archive.posts)),
  ]);
  return meta;
}

/** Resolve a handle to its archive: the cache when it's still valid for the
 * current txid set, a freshly-stitched (and, when Redis is available,
 * rewritten) one otherwise, or the pre-inscription preview as a last resort —
 * matching the un-cached fallback behaviour the profile page always had. */
async function resolveHandle(
  handle: string,
  fetchTxArchive: typeof fetchTxArchiveDefault,
  redis: Redis | null,
): Promise<Resolved | null> {
  const txids = await getXTxids(handle);
  if (txids.length > 0) {
    const hash = txidSetHash(txids);
    if (redis) {
      const cachedMeta = await redis.get<ArchiveMeta>(metaKey(handle));
      if (cachedMeta && cachedMeta.v === META_VERSION && cachedMeta.txidSetHash === hash) {
        return { kind: "cached", meta: cachedMeta, redis };
      }
    }

    const fresh = await stitchFresh(txids, fetchTxArchive);
    if (fresh) {
      const meta = redis
        ? await rebuildCache(handle, fresh.archive, hash, fresh.latestTxid, fresh.txCount, fresh.txTimes, redis)
        : freshMeta(fresh.archive, hash, fresh.latestTxid, fresh.txCount, fresh.txTimes);
      return { kind: "fresh", archive: fresh.archive, meta };
    }
    // Every per-transaction fetch failed — fall through to the preview map,
    // same as the un-cached page did before this module existed.
  }

  const preview = previewArchives[handle.toLowerCase()];
  if (!preview) return null;
  return { kind: "preview", archive: { profile: preview.profile, posts: dedupePosts(preview.posts) } };
}

/** Read only the chunks a `[start, end)` post window touches, and slice out
 * exactly that window — never the whole cached archive. */
async function readChunkRange(
  handle: string,
  start: number,
  end: number,
  redis: Redis,
): Promise<XPost[]> {
  if (start >= end) return [];
  const firstChunk = Math.floor(start / CHUNK_SIZE);
  const lastChunk = Math.floor((end - 1) / CHUNK_SIZE);
  const indices = Array.from({ length: lastChunk - firstChunk + 1 }, (_, i) => firstChunk + i);
  const chunks = await Promise.all(indices.map((n) => redis.get<XPost[]>(chunkKey(handle, n))));
  const posts = chunks.flatMap((chunk) => chunk ?? []);
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
    return { posts, ...pageInfoFromMeta(resolved.meta) };
  }

  if (resolved.kind === "fresh") {
    const { start, end } = slicePage(resolved.meta.postCount, offset, limit);
    return { posts: resolved.archive.posts.slice(start, end), ...pageInfoFromMeta(resolved.meta) };
  }

  // Preview — never inscribed, so there's no transaction data to report.
  const { start, end } = slicePage(resolved.archive.posts.length, offset, limit);
  return {
    posts: resolved.archive.posts.slice(start, end),
    postCount: resolved.archive.posts.length,
    profile: resolved.archive.profile,
    latestTxid: null,
    txTimes: {},
  };
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
