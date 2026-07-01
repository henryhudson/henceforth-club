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
 * no archive.
 */
export async function fetchTxArchive(txid: string): Promise<SocialArchive | null> {
  if (!/^[0-9a-fA-F]{64}$/.test(txid)) return null;

  let res: Response;
  try {
    res = await fetch(`${WOC}/tx/${txid}/hex`, { next: { revalidate: 3600 } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  return socialArchiveFromScripts(voutScriptsFromRawTx(await res.text()));
}
