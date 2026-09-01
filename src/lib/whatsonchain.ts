import { socialArchiveFromScripts, type SocialArchive } from "@/app/folklore/onchain";
import { voutScriptsFromRawTx } from "./rawTx";

const WOC = "https://api.whatsonchain.com/v1/bsv/main";
// BananaBlocks (GorillaPool's explorer) serves a WhatsOnChain-compatible
// mirror — same paths, same shapes — plus a native namespace whose parsed
// transaction endpoint carries what WhatsOnChain omits (fee, input values).
const BB_MIRROR = "https://bananablocks.com/api/v1/bsv/main";
const BB_NATIVE = "https://bananablocks.com/api/v1";
const BSV = 100_000_000;

// Byte reads try WhatsOnChain first, then the mirror — a base-URL swap, since
// the shapes match. WhatsOnChain stays primary (it is the independent source
// everywhere else); the mirror answers only when it doesn't, which is a real
// mode: on 2026-07-19 WhatsOnChain 403-bot-blocked while BananaBlocks served
// the same bytes. Returns the first ok response, or null when both fail.
async function fetchWithMirror(
  path: string,
  init: Parameters<typeof fetch>[1],
  fetchFn: typeof fetch,
): Promise<Response | null> {
  for (const base of [WOC, BB_MIRROR]) {
    try {
      const res = await fetchFn(`${base}${path}`, init);
      if (res.ok) return res;
    } catch {
      // fall through to the mirror; both-fail is the null below
    }
  }
  return null;
}

type WocTx = { vin?: Array<{ value?: number }>; vout?: Array<{ value?: number }> };

/** Pure: miner fee in sats, or null if any input value is missing / result negative (fail-open). */
export function txFeeSatsFromJson(tx: WocTx): number | null {
  const ins = tx.vin ?? [];
  if (ins.some((i) => typeof i.value !== "number")) return null;
  const inSats = ins.reduce((s, i) => s + Math.round((i.value as number) * BSV), 0);
  const outSats = (tx.vout ?? []).reduce((s, o) => s + Math.round((o.value ?? 0) * BSV), 0);
  const fee = inSats - outSats;
  return fee >= 0 ? fee : null;
}

type WocVin = { txid?: string; vout?: number; coinbase?: string };
type WocTxFull = { vin?: WocVin[]; vout?: Array<{ value?: number }> };

/** A transaction's miner fee in sats. BananaBlocks' parsed transaction
 * endpoint answers in one call (`fee` in sats, `has_fee`); WhatsOnChain's
 * omits input values, so its path costs one extra fetch per input. The one
 * call is tried first, the prevout walk remains the fallback. Fail-open
 * (null) on any unresolvable input or read error — a fee is never guessed. */
export async function fetchTxFeeSats(txid: string, fetchFn: typeof fetch = fetch): Promise<number | null> {
  const direct = await fetchBananaBlocksFee(txid, fetchFn);
  return direct ?? fetchTxFeeSatsFromPrevouts(txid, fetchFn);
}

async function fetchBananaBlocksFee(txid: string, fetchFn: typeof fetch): Promise<number | null> {
  try {
    const res = await fetchFn(`${BB_NATIVE}/tx/${txid}`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const tx = (await res.json()) as { fee?: number; has_fee?: boolean };
    return tx.has_fee === true && typeof tx.fee === "number" && Number.isInteger(tx.fee) && tx.fee >= 0
      ? tx.fee
      : null;
  } catch {
    return null;
  }
}

async function fetchTxFeeSatsFromPrevouts(txid: string, fetchFn: typeof fetch): Promise<number | null> {
  try {
    const res = await fetchFn(`${WOC}/tx/hash/${txid}`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const tx = (await res.json()) as WocTxFull;
    const inputs: Array<{ value?: number }> = [];
    for (const vin of tx.vin ?? []) {
      if (vin.txid == null || vin.vout == null) return null;          // coinbase / unresolvable
      const pres = await fetchFn(`${WOC}/tx/hash/${vin.txid}`, { next: { revalidate: 86400 } });
      if (!pres.ok) return null;
      const ptx = (await pres.json()) as WocTxFull;
      const prevout = ptx.vout?.[vin.vout];
      if (!prevout || typeof prevout.value !== "number") return null;
      inputs.push({ value: prevout.value });
    }
    return txFeeSatsFromJson({ vin: inputs, vout: tx.vout });         // unchanged pure fee math
  } catch {
    return null;
  }
}

/**
 * A transaction's output locking scripts (hex, vout order), from the RAW hex
 * endpoint — the JSON endpoint truncates `scriptPubKey.hex` at ~100,000 hex
 * characters, which silently cut off whole-profile archives (a 1,439-post
 * OP_RETURN is ~500,000). On-chain data is immutable, so the response is
 * cached for an hour. Returns null for a malformed txid or a failed fetch.
 * `fetchFn` is a test seam — callers inject a fake so their tests never hit
 * the network.
 */
export async function fetchTxScripts(
  txid: string,
  fetchFn: typeof fetch = fetch,
): Promise<string[] | null> {
  if (!/^[0-9a-fA-F]{64}$/.test(txid)) return null;

  const res = await fetchWithMirror(`/tx/${txid}/hex`, { next: { revalidate: 3600 } }, fetchFn);
  return res ? voutScriptsFromRawTx(await res.text()) : null;
}

/**
 * Fetch a transaction by id from WhatsOnChain and extract the SocialArchive
 * from its OP_RETURN data. Returns null for a malformed txid, a failed fetch,
 * or a tx with no archive.
 */
export async function fetchTxArchive(
  txid: string,
  fetchFn: typeof fetch = fetch,
): Promise<SocialArchive | null> {
  const scripts = await fetchTxScripts(txid, fetchFn);
  return scripts ? socialArchiveFromScripts(scripts) : null;
}

// A hung WhatsOnChain response must never stall a cache rebuild — the time
// lookup is best-effort, so it gets a hard ceiling and simply comes back
// unknown if the endpoint doesn't answer in time.
const TIME_LOOKUP_TIMEOUT_MS = 5000;

/**
 * Fetch a transaction's archive together with its confirmation time (unix
 * seconds). A raw transaction carries no notion of "when" — only
 * `nLockTime`, which is a different thing — so the time comes from a second,
 * lightweight call to WhatsOnChain's JSON transaction endpoint, read only for
 * its `time`/`blocktime` fields (the archive itself still comes from the raw
 * hex, so the JSON endpoint's script-length truncation never matters here).
 * An unconfirmed transaction, or one the time lookup otherwise fails to read,
 * comes back with `time: undefined` — unknown, not "never confirmed".
 *
 * `includeTime` lets a caller skip the time lookup altogether — set to
 * false when there's nowhere to cache the result, so every page view isn't
 * paying for a second round trip it can't reuse.
 */
export async function fetchTxArchiveWithTime(
  txid: string,
  fetchFn: typeof fetch = fetch,
  includeTime = true,
): Promise<{ archive: SocialArchive; time?: number } | null> {
  const archive = await fetchTxArchive(txid, fetchFn);
  if (!archive) return null;
  if (!includeTime) return { archive, time: undefined };
  return { archive, time: await fetchConfirmedTime(txid, fetchFn) };
}

/** The confirmation time alone, for a caller that already holds the archive
 *  (the transaction page, whose classifier parsed it from the same scripts). */
export async function fetchTxTime(txid: string, fetchFn: typeof fetch = fetch): Promise<number | undefined> {
  return fetchConfirmedTime(txid, fetchFn);
}

async function fetchConfirmedTime(
  txid: string,
  fetchFn: typeof fetch,
): Promise<number | undefined> {
  // One signal across both attempts: the ceiling bounds the whole lookup, so
  // adding the mirror never widens the stall a hung primary can cause.
  const res = await fetchWithMirror(
    `/tx/hash/${txid}`,
    { next: { revalidate: 3600 }, signal: AbortSignal.timeout(TIME_LOOKUP_TIMEOUT_MS) },
    fetchFn,
  );
  if (!res) return undefined;

  const body = (await res.json().catch(() => null)) as
    | { time?: number; blocktime?: number }
    | null;
  const time = body?.time ?? body?.blocktime;
  return typeof time === "number" ? time : undefined;
}
