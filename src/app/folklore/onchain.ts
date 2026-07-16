// Reads a profile archive back OUT of a Bitcoin transaction's OP_RETURN data.
//
// The Henceforth app inscribes the lean canonical `SocialArchive` JSON (the shape
// its XAPIMapper produces). This module parses that JSON out of a transaction's
// output scripts and maps it to the `XArchive` the profile page renders.
//
// Pure — no network. The WhatsOnChain fetch lives in `src/lib/whatsonchain.ts`.

import { dedupePosts, type XArchive, type XPost } from "./parseArchive";

/** The lean shape the app writes on-chain (mirror of the app's SocialArchive). */
export interface SocialArchive {
  v?: number;
  source: string; // "x" | "instagram" | …
  handle: string;
  profile: {
    displayName?: string;
    bio?: string;
    location?: string;
    website?: string;
    avatarUrl?: string;
    accountId?: string;
    createdAt?: string;
  };
  posts: Array<{
    id: string;
    at: string;
    text: string;
    replyToId?: string;
    mediaHashes?: string[];
    /** The tweet this post replied to, captured at archive time — author and
     * text only. Absent on older archives and on posts that reply to nothing;
     * the reader shows it when present and never fabricates it. */
    parent?: { author: string; text: string };
  }>;
}

const PUSHDATA1 = 0x4c;
const PUSHDATA2 = 0x4d;
const PUSHDATA4 = 0x4e;

/** Walk a script's bytes and return every pushed-data chunk (opcodes skipped). */
export function extractPushdata(scriptHex: string): Uint8Array[] {
  const bytes = hexToBytes(scriptHex);
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < bytes.length) {
    const op = bytes[i++];
    let len = 0;
    if (op >= 0x01 && op < PUSHDATA1) {
      len = op;
    } else if (op === PUSHDATA1) {
      len = bytes[i];
      i += 1;
    } else if (op === PUSHDATA2) {
      len = bytes[i] | (bytes[i + 1] << 8);
      i += 2;
    } else if (op === PUSHDATA4) {
      len =
        bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
      i += 4;
    } else {
      continue; // a real opcode (OP_FALSE, OP_RETURN, …) — carries no data
    }
    if (len <= 0 || i + len > bytes.length) break;
    out.push(bytes.slice(i, i + len));
    i += len;
  }
  return out;
}

/**
 * Scan every pushdata across the given output scripts and return the first chunk
 * that parses as a SocialArchive. Format-agnostic: works for a raw JSON OP_RETURN
 * or the B:// file-upload wrapper (where the JSON is one of several pushdatas).
 */
export function socialArchiveFromScripts(scriptHexes: string[]): SocialArchive | null {
  for (const hex of scriptHexes) {
    for (const chunk of extractPushdata(hex)) {
      const sa = tryParseArchive(chunk);
      if (sa) return sa;
    }
  }
  return null;
}

function tryParseArchive(chunk: Uint8Array): SocialArchive | null {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(chunk).trim();
  if (!text.startsWith("{")) return null;
  try {
    const o = JSON.parse(text) as unknown;
    if (
      o &&
      typeof o === "object" &&
      typeof (o as SocialArchive).source === "string" &&
      typeof (o as SocialArchive).handle === "string" &&
      Array.isArray((o as SocialArchive).posts)
    ) {
      return o as SocialArchive;
    }
  } catch {
    // not JSON — skip
  }
  return null;
}

/** ORDFS serves an inscription's bytes with the correct Content-Type by outpoint. */
export function ordfsUrl(txid: string, vout: string): string {
  return `https://ordfs.network/${txid}_${vout}`;
}

/** Pure. The media kind a Content-Type denotes. The archive JSON records only
 * vouts, so the inscription itself is the only source of truth for what a
 * media reference IS — and ORDFS serves it with the right Content-Type. An
 * unreadable or unknown type stays a photo: the previous behaviour, and an
 * <img> that fails to load is a smaller wrong than a <video> that can't play. */
export function mediaKind(contentType: string | null | undefined): "photo" | "video" {
  return (contentType ?? "").toLowerCase().startsWith("video/") ? "video" : "photo";
}

/** Ask ORDFS what each media reference actually is, once, at cache-build time.
 * A profile's media count is small and an archive's transaction set is
 * immutable, so this runs only when the cache is rebuilt — never per reader.
 * A failed HEAD falls back to photo rather than dropping the media. */
export async function resolveMediaKinds(
  archive: XArchive,
  fetchFn: typeof fetch = fetch,
): Promise<XArchive> {
  const urls = [...new Set(archive.posts.flatMap((p) => (p.media ?? []).map((m) => m.url)))];
  const kinds = new Map<string, "photo" | "video">();
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetchFn(url, { method: "HEAD" });
        kinds.set(url, mediaKind(res.headers.get("content-type")));
      } catch {
        kinds.set(url, "photo");
      }
    }),
  );
  return {
    ...archive,
    posts: archive.posts.map((p) =>
      p.media
        ? { ...p, media: p.media.map((m) => ({ ...m, type: kinds.get(m.url) ?? m.type })) }
        : p,
    ),
  };
}

/** Map the lean on-chain archive to the shape the profile page renders. When a
 * `txid` is given, each post's media references (the ordinal vouts the app
 * recorded) resolve to ORDFS-backed photo items against that archive transaction. */
export function socialArchiveToXArchive(sa: SocialArchive, txid?: string): XArchive {
  return {
    profile: {
      handle: sa.handle,
      displayName: sa.profile?.displayName,
      bio: sa.profile?.bio,
      location: sa.profile?.location?.trim(),
      website: sa.profile?.website,
      avatarUrl: sa.profile?.avatarUrl,
      createdAt: sa.profile?.createdAt,
    },
    posts: (sa.posts ?? []).map(
      (p): XPost => ({
        id: p.id,
        at: p.at,
        text: p.text,
        replyToId: p.replyToId,
        parent: p.parent,
        txid,
        media:
          txid && p.mediaHashes?.length
            ? p.mediaHashes.map((vout) => ({ type: "photo", url: ordfsUrl(txid, vout) }))
            : undefined,
      }),
    ),
  };
}

/**
 * Merge several on-chain archives of one handle into the renderable profile,
 * resolving each post's media against the transaction it was ACTUALLY inscribed
 * in — a photo backfilled in a later transaction must form its ORDFS outpoint
 * from that transaction's id, not the newest one. Posts are de-duplicated by id:
 * fields come from the newest archive's copy, but media is the UNION across all
 * copies (newest first, de-duplicated by url) — a later text-only re-archive
 * must never erase photos inscribed, and paid for, earlier. The profile comes
 * from the most recent archive; posts come out newest-first by post id. Input
 * is oldest-first.
 */
export function stitchToXArchive(
  pairs: Array<{ archive: SocialArchive; txid: string }>,
): XArchive {
  const rendered = pairs.map(({ archive, txid }) => socialArchiveToXArchive(archive, txid));
  const latest = rendered[rendered.length - 1];
  const merged = new Map<string, XPost>();
  for (let i = rendered.length - 1; i >= 0; i--) {
    for (const post of rendered[i].posts) {
      const newer = merged.get(post.id);
      merged.set(post.id, newer ? withMediaFromOlderCopy(newer, post) : post);
    }
  }
  return { profile: latest.profile, posts: [...merged.values()].sort(byNewestId) };
}

/**
 * Merge already-rendered CACHED posts with the posts of a freshly-stitched
 * DELTA (new archive transactions appended to an immutable prefix), under the
 * exact rules a full `stitchToXArchive` + `dedupePosts` pass would apply: the
 * delta's copy of a post wins on fields, media is the union (newest first),
 * order is newest-first by id, and an older post whose text duplicates a
 * newer one is dropped. This is what lets the cache grow by fetching ONLY
 * the new transactions — never re-downloading the (potentially enormous)
 * archive transactions the cached posts already came from.
 */
export function mergeDeltaPosts(cachedPosts: XPost[], deltaPosts: XPost[]): XPost[] {
  const merged = new Map<string, XPost>();
  for (const post of deltaPosts) merged.set(post.id, post);
  for (const older of cachedPosts) {
    const newer = merged.get(older.id);
    merged.set(older.id, newer ? withMediaFromOlderCopy(newer, older) : older);
  }
  return dedupePosts([...merged.values()].sort(byNewestId));
}

/** The newer copy's fields, with any media the older copy carries that the newer
 * one lacks appended. Media urls identify inscriptions exactly — each already
 * embeds the transaction the photo was inscribed in — so de-duplicating by url
 * is safe. */
function withMediaFromOlderCopy(newer: XPost, older: XPost): XPost {
  const kept = newer.media ?? [];
  const knownUrls = new Set(kept.map((m) => m.url));
  const carried = (older.media ?? []).filter((m) => !knownUrls.has(m.url));
  const media = [...kept, ...carried];
  return { ...newer, media: media.length > 0 ? media : undefined };
}

/** Newest post first. X post ids are numeric snowflakes that grow over time but
 * exceed the safe-integer range, so compare as strings: a longer id is newer;
 * ids of equal length compare lexicographically. */
function byNewestId(a: XPost, b: XPost): number {
  if (a.id.length !== b.id.length) return b.id.length - a.id.length;
  return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? "0" + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
