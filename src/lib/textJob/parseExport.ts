// An X data-export zip becomes a text-only archive, or a reasoned refusal.
// Pure: no network, no filesystem reads, no clock, no randomness — the same
// zip bytes always produce the same result, including the same contentHash.

import { unzipSync } from "fflate";
import { Hash, Utils } from "@bsv/sdk";
import type { SocialArchive } from "@/app/text/onchain";
import { unwrap } from "@/app/text/parseArchive";

export type ParsedExport =
  | { ok: true; handle: string; archive: SocialArchive; archiveBytes: number; contentHash: string }
  | { ok: false; reason: "bad-zip" | "no-tweets-file" | "too-large" | "no-posts" | "no-handle" };

interface RawTweet {
  tweet?: { id_str?: string; created_at?: string; full_text?: string };
}

interface RawAccount {
  account?: { username?: string };
}

type Post = SocialArchive["posts"][number];

/** The same handle rule the api routes enforce; the parser is the last gate
 * before the visitor pays, so anything looser here becomes an inscription
 * that registration later refuses. */
const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

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

/** Deliberately not src/app/text/archiveBytes.ts: that module is a browser
 * preview estimate over the renderable shape, free to drift toward whatever
 * the preview page needs. The paid path must price the exact bytes that will
 * be inscribed — this measures the archive value itself, the very JSON the
 * content hash pins and the worker broadcasts. Do not unify the two; they
 * answer different questions. The shared principle is only that both count
 * encoded bytes, not characters, so an emoji costs what it actually costs. */
function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function toPost(entry: RawTweet): Post | null {
  const t = entry.tweet;
  if (!t?.id_str || !t?.created_at || !t?.full_text) return null;
  return { id: t.id_str, at: t.created_at, text: t.full_text };
}

/** The handle lives in data/account.js — tweet records carry no username.
 * Downstream, the handle rides through job creation, payment, and an
 * irreversible broadcast before registration ever checks it, so a missing,
 * unparseable, or invalid handle must refuse here, at the only pre-payment
 * gate. Null means refuse with no-handle; there is no silent fallback. */
function extractHandle(files: Record<string, Uint8Array>): string | null {
  const accountEntry = findEntry(files, "account.js");
  if (!accountEntry) return null;
  try {
    const accounts = unwrap(decodeUtf8(accountEntry));
    if (!Array.isArray(accounts)) return null;
    const username = (accounts as RawAccount[])[0]?.account?.username;
    return typeof username === "string" && HANDLE_PATTERN.test(username) ? username : null;
  } catch {
    return null;
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

  let unwrapped: unknown;
  try {
    unwrapped = unwrap(decodeUtf8(tweetsEntry));
  } catch {
    return { ok: false, reason: "bad-zip" };
  }
  if (!Array.isArray(unwrapped)) return { ok: false, reason: "bad-zip" };
  const rawTweets = unwrapped as RawTweet[];

  const posts = rawTweets.map(toPost).filter((p): p is Post => p !== null);
  if (posts.length === 0) return { ok: false, reason: "no-posts" };

  const handle = extractHandle(files);
  if (handle === null) return { ok: false, reason: "no-handle" };

  const archive: SocialArchive = { v: 1, source: "x", handle, profile: {}, posts };

  const archiveBytes = jsonByteLength(archive);
  if (archiveBytes > maxBytes) return { ok: false, reason: "too-large" };

  const contentHash = Utils.toHex(Hash.sha256(JSON.stringify(archive)));

  return { ok: true, handle, archive, archiveBytes, contentHash };
}
