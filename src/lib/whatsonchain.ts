import { socialArchiveFromScripts, type SocialArchive } from "@/app/text/onchain";
import { voutScriptsFromRawTx } from "./rawTx";

const WOC = "https://api.whatsonchain.com/v1/bsv/main";
const BSV = 100_000_000;

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

/** A transaction's miner fee in sats. WhatsOnChain's tx endpoint omits input
 * values, so each input's value is resolved from its prevout (the referenced
 * output of `vin.txid`). Fail-open (null) on any unresolvable input or read
 * error — a fee is never guessed. */
export async function fetchTxFeeSats(txid: string, fetchFn: typeof fetch = fetch): Promise<number | null> {
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
 * Fetch a transaction by id from WhatsOnChain and extract the SocialArchive from
 * its OP_RETURN data. Uses the RAW hex endpoint and parses the output scripts
 * locally — the JSON endpoint truncates `scriptPubKey.hex` at ~100,000 hex
 * characters, which silently cut off whole-profile archives (a 1,439-post
 * OP_RETURN is ~500,000). On-chain data is immutable, so the response is cached
 * for an hour. Returns null for a malformed txid, a failed fetch, or a tx with
 * no archive. `fetchFn` is a test seam — `xArchiveCache` injects a fake one so
 * its own tests never hit the network.
 */
export async function fetchTxArchive(
  txid: string,
  fetchFn: typeof fetch = fetch,
): Promise<SocialArchive | null> {
  if (!/^[0-9a-fA-F]{64}$/.test(txid)) return null;

  let res: Response;
  try {
    res = await fetchFn(`${WOC}/tx/${txid}/hex`, { next: { revalidate: 3600 } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  return socialArchiveFromScripts(voutScriptsFromRawTx(await res.text()));
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

async function fetchConfirmedTime(
  txid: string,
  fetchFn: typeof fetch,
): Promise<number | undefined> {
  let res: Response;
  try {
    res = await fetchFn(`${WOC}/tx/hash/${txid}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(TIME_LOOKUP_TIMEOUT_MS),
    });
  } catch {
    return undefined;
  }
  if (!res.ok) return undefined;

  const body = (await res.json().catch(() => null)) as
    | { time?: number; blocktime?: number }
    | null;
  const time = body?.time ?? body?.blocktime;
  return typeof time === "number" ? time : undefined;
}
