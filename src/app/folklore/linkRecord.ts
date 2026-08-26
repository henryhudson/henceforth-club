// The folklore board's two on-chain record kinds — a link and a comment —
// beside `SocialArchive`, written and parsed by the same pushdata machinery
// (extractPushdata). Validation is total: refusals are null, never throws,
// and the parser funnels through the same validators the submit path uses,
// so the caps hold on read by construction — a hostile chain record is
// invisible, not an error.

import { extractPushdata } from "./onchain";

export const TITLE_MAX = 300;
export const COMMENT_MAX = 10_000;
export const TXID_RE = /^[0-9a-fA-F]{64}$/;

export type FolkloreLink = {
  v: 1;
  app: "folklore";
  kind: "link";
  title: string;
  by?: string;
  /** Target transaction being listed. Preferred over `url`. */
  txid?: string;
  /** Legacy https destination. */
  url?: string;
};
export type FolkloreComment = {
  v: 1;
  app: "folklore";
  kind: "comment";
  parent: string;
  text: string;
  by?: string;
};
export type FolkloreRecord = FolkloreLink | FolkloreComment;

const httpUrl = (u: string): boolean => {
  try {
    const p = new URL(u).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
};

export function validateLink(urlOrTxid: string, title: string, by?: string): FolkloreLink | null {
  const t = title.trim();
  if (t.length === 0 || t.length > TITLE_MAX) return null;
  const byField = by ? { by } : {};
  if (TXID_RE.test(urlOrTxid)) {
    return { v: 1, app: "folklore", kind: "link", txid: urlOrTxid.toLowerCase(), title: t, ...byField };
  }
  if (!httpUrl(urlOrTxid)) return null;
  return { v: 1, app: "folklore", kind: "link", url: urlOrTxid, title: t, ...byField };
}

export function validateComment(parent: string, text: string, by?: string): FolkloreComment | null {
  const t = text.trim();
  if (!TXID_RE.test(parent) || t.length === 0 || t.length > COMMENT_MAX) return null;
  return { v: 1, app: "folklore", kind: "comment", parent, text: t, ...(by ? { by } : {}) };
}

export const encodeRecord = (r: FolkloreRecord): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(r));

/**
 * The exact line a submitter signs to prove the `by` handle is theirs.
 *
 * Derived from encodeRecord and nothing else, so the signature commits to the
 * very bytes that will be inscribed — the same one-encoder doctrine that keeps
 * the priced bytes, the content hash and the OP_RETURN from disagreeing. A
 * signature therefore cannot be lifted onto a different url, title, parent,
 * text, or handle: change any field and this string changes with it.
 *
 * The prefix namespaces it away from registrationMessage, so neither
 * signature is ever valid where the other is expected.
 */
export const submitMessage = (r: FolkloreRecord): string =>
  `henceforth-folklore-submit:${new TextDecoder().decode(encodeRecord(r))}`;

/** Scan every pushdata across the given output scripts and return the first
 * chunk that validates as a folklore record. */
export function recordFromScripts(scriptHexes: string[]): FolkloreRecord | null {
  for (const hex of scriptHexes) {
    for (const chunk of extractPushdata(hex)) {
      const rec = tryParse(chunk);
      if (rec) return rec;
    }
  }
  return null;
}

/** The object-level shape gate the byte parser funnels through — exported so
 * the worker can classify a stored job payload with the same validators the
 * submit route used, never a second shape check. */
export function recordFromValue(j: unknown): FolkloreRecord | null {
  if (typeof j !== "object" || j === null) return null;
  const o = j as Record<string, unknown>;
  if (o.v !== 1 || o.app !== "folklore") return null;
  if (o.kind === "link" && typeof o.title === "string") {
    const target = typeof o.txid === "string" ? o.txid : typeof o.url === "string" ? o.url : null;
    if (target === null) return null;
    return validateLink(target, o.title, typeof o.by === "string" ? o.by : undefined);
  }
  if (o.kind === "comment" && typeof o.parent === "string" && typeof o.text === "string") {
    return validateComment(o.parent, o.text, typeof o.by === "string" ? o.by : undefined);
  }
  return null;
}

function tryParse(bytes: Uint8Array): FolkloreRecord | null {
  try {
    return recordFromValue(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
