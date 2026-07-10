// An X data-export zip becomes a text-only archive, or a reasoned refusal.
// Pure: no network, no filesystem reads, no clock, no randomness — the same
// zip bytes always produce the same result, including the same contentHash.

import { unzipSync } from "fflate";
import { Hash, Utils } from "@bsv/sdk";
import type { SocialArchive } from "@/app/text/onchain";
import { unwrap } from "@/app/text/parseArchive";

export type ParsedExport =
  | { ok: true; handle: string; archive: SocialArchive; archiveBytes: number; contentHash: string }
  | { ok: false; reason: "bad-zip" | "no-tweets-file" | "too-large" | "no-posts" };

interface RawTweet {
  tweet?: { id_str?: string; created_at?: string; full_text?: string };
}

interface RawAccount {
  account?: { username?: string };
}

type Post = SocialArchive["posts"][number];

/** A real export nests every data file under `data/`; match by suffix so the
 * path prefix doesn't matter, the same tolerance dropZone.ts's exact-name
 * matching gives the browser-upload path. */
function findEntry(files: Record<string, Uint8Array>, suffix: string): Uint8Array | undefined {
  const key = Object.keys(files).find((name) => name.toLowerCase().endsWith(suffix));
  return key ? files[key] : undefined;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

/** Same principle as estimateArchiveBytes in src/app/text/archiveBytes.ts:
 * count encoded bytes, not characters, so an emoji costs what it actually
 * costs on chain. */
function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function toPost(entry: RawTweet): Post | null {
  const t = entry.tweet;
  if (!t?.id_str || !t?.created_at || !t?.full_text) return null;
  return { id: t.id_str, at: t.created_at, text: t.full_text };
}

/** account.js carries the handle a real export needs; a fixture built from
 * tweets.js alone (this task's minimum requirement) has none. Falling back to
 * an empty string keeps parsing total rather than adding a failure mode the
 * ParsedExport union doesn't name. */
function extractHandle(files: Record<string, Uint8Array>): string {
  const accountEntry = findEntry(files, "account.js");
  if (!accountEntry) return "";
  try {
    const accounts = unwrap(decodeUtf8(accountEntry)) as RawAccount[];
    return accounts[0]?.account?.username ?? "";
  } catch {
    return "";
  }
}

export function parseXExport(zip: Uint8Array, maxBytes: number): ParsedExport {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    return { ok: false, reason: "bad-zip" };
  }

  const tweetsEntry = findEntry(files, "tweets.js");
  if (!tweetsEntry) return { ok: false, reason: "no-tweets-file" };

  let rawTweets: RawTweet[];
  try {
    rawTweets = unwrap(decodeUtf8(tweetsEntry)) as RawTweet[];
  } catch {
    return { ok: false, reason: "bad-zip" };
  }

  const posts = rawTweets.map(toPost).filter((p): p is Post => p !== null);
  if (posts.length === 0) return { ok: false, reason: "no-posts" };

  const handle = extractHandle(files);
  const archive: SocialArchive = { v: 1, source: "x", handle, profile: {}, posts };

  const archiveBytes = jsonByteLength(archive);
  if (archiveBytes > maxBytes) return { ok: false, reason: "too-large" };

  const contentHash = Utils.toHex(Hash.sha256(JSON.stringify(archive)));

  return { ok: true, handle, archive, archiveBytes, contentHash };
}
