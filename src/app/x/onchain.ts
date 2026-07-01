// Reads a profile archive back OUT of a Bitcoin transaction's OP_RETURN data.
//
// The Henceforth app inscribes the lean canonical `SocialArchive` JSON (the shape
// its XAPIMapper produces). This module parses that JSON out of a transaction's
// output scripts and maps it to the `XArchive` the profile page renders.
//
// Pure — no network. The WhatsOnChain fetch lives in `src/lib/whatsonchain.ts`.

import type { XArchive, XPost } from "./parseArchive";

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
  posts: Array<{ id: string; at: string; text: string; replyToId?: string; mediaHashes?: string[] }>;
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
        media:
          txid && p.mediaHashes?.length
            ? p.mediaHashes.map((vout) => ({ type: "photo", url: ordfsUrl(txid, vout) }))
            : undefined,
      }),
    ),
  };
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? "0" + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
