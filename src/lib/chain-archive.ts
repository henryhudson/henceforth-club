// The head index and the reader — the archive found without the store.
//
// The archive address's own newest inscription IS the index: a head document
// (surface "head") whose sealed payload maps every surface to its current
// transaction. One read resolves the head, a second fetches the document.
// Constant time, no vendor, and the history stays walkable through each
// envelope's previous-transaction field.
//
// Two indexers serve the same interface; the second is the base-URL fallback.
// When every base refuses, the result says "unreachable" — an archive whose
// indexers are down is not an empty archive, and must never read as one.

import { OP, Script, Transaction, Utils } from "@bsv/sdk";
import { openSealed } from "./board-pdf-crypto";
import { CHAIN_MARKER } from "./board-pdf";

export const HEAD_SURFACE = "head";

// The archive address is public — it is the index's identity, not a secret;
// the key that opens what is inscribed there is BOARD_ARCHIVE_KEY. Overridable
// so a rotated key needs an environment change, not a deploy.
export const ARCHIVE_ADDRESS_DEFAULT = "14wYnqxnprgqy11gCKSG3Z9KLcUCKWiWfq";

// Surface names, mirrored in scripts/board/chain-publish-core.mjs (the
// writer); the sync test pins the two together.
export const SURFACE = {
  board: "board-latest",
  done: "board-done",
  gardening: "board-gardening",
  report: (date: string): string => `board-report-${date}`,
  week: (date: string): string => `board-week-${date}`,
  edition: (kind: string, date: string): string => `${kind}-edition-${date}`,
} as const;
const REPORT_PREFIX = "board-report-";
const WEEK_PREFIX = "board-week-";
export const reportDateOf = (surface: string): string | null =>
  surface.startsWith(REPORT_PREFIX) ? surface.slice(REPORT_PREFIX.length) : null;
export const weekDateOf = (surface: string): string | null =>
  surface.startsWith(WEEK_PREFIX) ? surface.slice(WEEK_PREFIX.length) : null;

export const INDEXER_BASES = [
  "https://api.whatsonchain.com/v1/bsv/main",
  "https://bananablocks.com/api/v1/bsv/main",
] as const;

// How many of the address's newest transactions may sit between "now" and the
// newest head before the reader gives up. Ordinary publishing puts the head
// last, so it is transaction one or two; the allowance is for a run that died
// between a document and its head.
const HEAD_WALK_LIMIT = 12;

export type ChainEnvelope = {
  surface: string;
  date: string;
  keyId: string;
  previousTxid: string | null;
  sealed: Uint8Array;
};

export type HeadPayload = { v: 1; surfaces: Record<string, string> };

export type HeadResolution =
  | { status: "ok"; headTxid: string; head: HeadPayload }
  | { status: "no-head"; detail: string }
  | { status: "unreachable"; detail: string }
  | { status: "corrupt"; detail: string };

export type ChainReadResult =
  | { status: "ok"; document: Uint8Array; txid: string; headTxid: string }
  | { status: "no-head"; detail: string }
  | { status: "missing"; surface: string; headTxid: string }
  | { status: "unreachable"; detail: string }
  | { status: "corrupt"; detail: string };

type Fetcher = typeof fetch;

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The chain envelope in a transaction's data output, or null when no output
 *  carries one. Throws only on hex that is not a transaction at all. */
export function envelopeFromTx(hex: string): ChainEnvelope | null {
  const tx = Transaction.fromHex(hex);
  for (const o of tx.outputs) {
    // The SDK's chunk parser stops at OP_RETURN and lumps everything after it
    // into that chunk's raw `data` — re-parse the blob for the pushes.
    const [op0, op1] = o.lockingScript.chunks;
    if (op0?.op !== OP.OP_FALSE || op1?.op !== OP.OP_RETURN || !op1.data) continue;
    const fields = Script.fromBinary(op1.data).chunks;
    if (fields.length !== 6) continue;
    const text = (i: number): string | null => {
      const data = fields[i]?.data;
      return data ? Utils.toUTF8(data) : null;
    };
    const sealed = fields[5]?.data;
    const surface = text(1);
    const date = text(2);
    const keyId = text(3);
    const previous = text(4);
    if (text(0) !== CHAIN_MARKER || !sealed || !surface || !date || !keyId || !previous) continue;
    return {
      surface,
      date,
      keyId,
      previousTxid: previous === "-" ? null : previous,
      sealed: new Uint8Array(sealed),
    };
  }
  return null;
}

/** The head payload, refused rather than partially accepted — a reader never
 *  acts on a map the writer would not have signed. Mirrors
 *  scripts/board/chain-head.mjs, and the sync test pins the two together. */
export function parseHeadPayload(bytes: Uint8Array): HeadPayload {
  const parsed: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  if (parsed === null || typeof parsed !== "object") throw new Error("head payload is not an object");
  const head = parsed as { v?: unknown; surfaces?: unknown };
  if (head.v !== 1) throw new Error(`head payload version ${JSON.stringify(head.v)} is not 1`);
  if (head.surfaces === null || typeof head.surfaces !== "object") throw new Error("head payload has no surfaces map");
  const surfaces = head.surfaces as Record<string, unknown>;
  const entries = Object.entries(surfaces);
  if (entries.length === 0) throw new Error("a head must name at least one surface");
  for (const [surface, txid] of entries) {
    if (!/^[a-z][a-z0-9-]*$/.test(surface)) throw new Error(`surface must be a lowercase slug, got ${JSON.stringify(surface)}`);
    if (typeof txid !== "string" || !/^[0-9a-f]{64}$/.test(txid)) throw new Error(`surface ${surface} names an invalid transaction id`);
  }
  return { v: 1, surfaces: surfaces as Record<string, string> };
}

/** GET against each indexer base in turn; the first 2xx answers. Throws only
 *  when every base refused, carrying each base's own failure. */
async function firstAnswer(path: string, fetchImpl: Fetcher): Promise<Response> {
  const failures: string[] = [];
  for (const base of INDEXER_BASES) {
    try {
      const resp = await fetchImpl(`${base}${path}`);
      if (resp.ok) return resp;
      failures.push(`${base}: ${resp.status}`);
    } catch (e) {
      failures.push(`${base}: ${message(e)}`);
    }
  }
  throw new Error(failures.join("; "));
}

type HistoryRow = { tx_hash: string; height?: number };

/** The rows of a history answer. The endpoints disagree on shape: one returns
 *  a bare array, the other wraps it in `result`. Reading only the array shape
 *  threw on the object, and the caller's catch turned that into "this address
 *  has no mempool" — which is how a freshly published head went unseen. */
export function historyRows(payload: unknown): HistoryRow[] {
  const rows = Array.isArray(payload)
    ? payload
    : (payload as { result?: unknown } | null)?.result;
  if (!Array.isArray(rows)) return [];
  return rows.filter((r): r is HistoryRow => typeof (r as HistoryRow)?.tx_hash === "string");
}

/** Confirmed rows, newest first. Ordered by the height each row carries rather
 *  than by the order the indexer happened to send: two indexers serve this
 *  address and they do not agree on it. Rows without a height keep their
 *  relative order at the front, since an unheighted row is a mempool row. */
export function newestFirstByHeight(rows: HistoryRow[]): string[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (b.row.height ?? Infinity) - (a.row.height ?? Infinity) || a.index - b.index)
    .map(({ row }) => row.tx_hash);
}

/** The address's transaction ids, newest first: mempool ahead of confirmed.
 *  A mirror without the unconfirmed endpoint degrades to confirmed-only. */
async function newestFirstHistory(address: string, fetchImpl: Fetcher): Promise<string[]> {
  const txids: string[] = [];
  try {
    const resp = await firstAnswer(`/address/${address}/unconfirmed/history`, fetchImpl);
    // Mempool rows arrive newest first, and the head of a publish is its last
    // transaction — so this order is the one that finds it.
    txids.push(...historyRows(await resp.json()).map((r) => r.tx_hash));
  } catch {
    // No mempool view is not an error — the confirmed walk below still answers.
  }
  const resp = await firstAnswer(`/address/${address}/history`, fetchImpl);
  txids.push(...newestFirstByHeight(historyRows(await resp.json())));
  return [...new Set(txids)];
}

/** Walk the address's newest transactions until a head opens. A head that is
 *  present but will not open is CORRUPT, not skippable — falling back to an
 *  older head would silently serve a stale index. */
export async function resolveHead({
  address,
  keyHex,
  fetchImpl = fetch,
}: {
  address: string;
  keyHex: string;
  fetchImpl?: Fetcher;
}): Promise<HeadResolution> {
  let txids: string[];
  try {
    txids = await newestFirstHistory(address, fetchImpl);
  } catch (e) {
    return { status: "unreachable", detail: `every indexer refused the address history: ${message(e)}` };
  }
  for (const txid of txids.slice(0, HEAD_WALK_LIMIT)) {
    let hex: string;
    try {
      hex = (await (await firstAnswer(`/tx/${txid}/hex`, fetchImpl)).text()).trim();
    } catch (e) {
      return { status: "unreachable", detail: `every indexer refused transaction ${txid}: ${message(e)}` };
    }
    let envelope: ChainEnvelope | null;
    try {
      envelope = envelopeFromTx(hex);
    } catch {
      continue; // a foreign or malformed transaction in the history is not ours to judge
    }
    if (!envelope || envelope.surface !== HEAD_SURFACE) continue;
    try {
      return { status: "ok", headTxid: txid, head: parseHeadPayload(openSealed(envelope.sealed, keyHex)) };
    } catch (e) {
      return { status: "corrupt", detail: `head ${txid} would not open: ${message(e)}` };
    }
  }
  return {
    status: "no-head",
    detail: `no head inscription among the newest ${HEAD_WALK_LIMIT} transactions at ${address}`,
  };
}

/** Resolve the head, then fetch and open the named surface. Every outcome is
 *  a distinct state; in particular, indexers down is "unreachable" — never an
 *  empty read. */
export async function readSurface({
  surface,
  address,
  keyHex,
  fetchImpl = fetch,
}: {
  surface: string;
  address: string;
  keyHex: string;
  fetchImpl?: Fetcher;
}): Promise<ChainReadResult> {
  const resolved = await resolveHead({ address, keyHex, fetchImpl });
  if (resolved.status !== "ok") return resolved;
  return readFromHead({ resolved, surface, keyHex, fetchImpl });
}

export type ResolvedHead = Extract<HeadResolution, { status: "ok" }>;

/** Fetch and open one surface named by an already-resolved head, so a caller
 *  serving several surfaces resolves the head once and reads from it. */
export async function readFromHead({
  resolved,
  surface,
  keyHex,
  fetchImpl = fetch,
}: {
  resolved: ResolvedHead;
  surface: string;
  keyHex: string;
  fetchImpl?: Fetcher;
}): Promise<ChainReadResult> {
  const txid = resolved.head.surfaces[surface];
  if (!txid) return { status: "missing", surface, headTxid: resolved.headTxid };
  let hex: string;
  try {
    hex = (await (await firstAnswer(`/tx/${txid}/hex`, fetchImpl)).text()).trim();
  } catch (e) {
    return { status: "unreachable", detail: `every indexer refused document ${txid}: ${message(e)}` };
  }
  let envelope: ChainEnvelope | null;
  try {
    envelope = envelopeFromTx(hex);
  } catch (e) {
    return { status: "corrupt", detail: `transaction ${txid} is not readable: ${message(e)}` };
  }
  if (!envelope || envelope.surface !== surface) {
    return { status: "corrupt", detail: `transaction ${txid} does not carry a ${surface} envelope` };
  }
  try {
    return { status: "ok", document: openSealed(envelope.sealed, keyHex), txid, headTxid: resolved.headTxid };
  } catch (e) {
    return { status: "corrupt", detail: `document ${txid} would not open: ${message(e)}` };
  }
}
