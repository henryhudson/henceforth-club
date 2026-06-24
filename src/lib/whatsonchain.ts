import { socialArchiveFromScripts, type SocialArchive } from "@/app/x/onchain";

const WOC = "https://api.whatsonchain.com/v1/bsv/main";

interface WoCTx {
  vout?: Array<{ scriptPubKey?: { hex?: string } }>;
}

/**
 * Fetch a transaction by id from WhatsOnChain and extract the SocialArchive from
 * its OP_RETURN data. On-chain data is immutable, so the response is cached for an
 * hour. Returns null for a malformed txid, a failed fetch, or a tx with no archive.
 */
export async function fetchTxArchive(txid: string): Promise<SocialArchive | null> {
  if (!/^[0-9a-fA-F]{64}$/.test(txid)) return null;

  let res: Response;
  try {
    res = await fetch(`${WOC}/tx/hash/${txid}`, { next: { revalidate: 3600 } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const tx = (await res.json()) as WoCTx;
  const scripts = (tx.vout ?? [])
    .map((v) => v.scriptPubKey?.hex)
    .filter((h): h is string => typeof h === "string" && h.length > 0);

  return socialArchiveFromScripts(scripts);
}
