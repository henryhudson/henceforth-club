import { socialArchiveFromScripts, type SocialArchive } from "@/app/x/onchain";
import { voutScriptsFromRawTx } from "./rawTx";

const WOC = "https://api.whatsonchain.com/v1/bsv/main";

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

/**
 * Fetch a transaction's archive together with its confirmation time (unix
 * seconds). A raw transaction carries no notion of "when" — only
 * `nLockTime`, which is a different thing — so the time comes from a second,
 * lightweight call to WhatsOnChain's JSON transaction endpoint, read only for
 * its `time`/`blocktime` fields (the archive itself still comes from the raw
 * hex, so the JSON endpoint's script-length truncation never matters here).
 * An unconfirmed transaction, or one the time lookup otherwise fails to read,
 * comes back with `time: undefined` — unknown, not "never confirmed".
 */
export async function fetchTxArchiveWithTime(
  txid: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ archive: SocialArchive; time?: number } | null> {
  const archive = await fetchTxArchive(txid, fetchFn);
  if (!archive) return null;
  return { archive, time: await fetchConfirmedTime(txid, fetchFn) };
}

async function fetchConfirmedTime(
  txid: string,
  fetchFn: typeof fetch,
): Promise<number | undefined> {
  let res: Response;
  try {
    res = await fetchFn(`${WOC}/tx/hash/${txid}`, { next: { revalidate: 3600 } });
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
