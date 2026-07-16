import { getXTxids } from "./xIndex";
import { fetchTxArchive } from "./whatsonchain";
import { archiveDigest, getTxDigest, setTxDigest, type TxDigest } from "./xDigest";

/**
 * What a handle already has on chain, unioned across all of its archive
 * transactions. Extracted from /api/x/archived so the archive and quote
 * routes can derive the read bound from the SAME set the app derives its
 * inscription delta from — one source of "already archived", two layers
 * (text posts and their media) because a post archived text-only can still
 * have its photos backfilled later.
 */
export type ArchivedSets = {
  txids: string[];
  tweetIds: Set<string>;
  mediaPostIds: Set<string>;
};

/**
 * Null means the index could not be read COMPLETELY — and a partial union
 * must never be presented as authoritative. For inscription a partial set
 * would re-inscribe (and re-pay for) posts already on chain; for the read
 * bound it would be merely conservative, but callers cannot tell which
 * failure they got, so the contract stays refuse-outright for both.
 */
export async function archivedTweetIds(handle: string): Promise<ArchivedSets | null> {
  const txids = await getXTxids(handle);
  const tweetIds = new Set<string>();
  const mediaPostIds = new Set<string>();
  for (const txid of txids) {
    const digest = await resolveDigest(txid);
    if (!digest) return null;
    for (const id of digest.tweetIds) tweetIds.add(id);
    for (const id of digest.mediaPostIds) mediaPostIds.add(id);
  }
  return { txids, tweetIds, mediaPostIds };
}

/**
 * A transaction's digest: from the forever-cache when present, otherwise
 * derived from a fresh fetch and written back. Null only when the
 * transaction cannot be resolved at all.
 */
async function resolveDigest(txid: string): Promise<TxDigest | null> {
  const cached = await getTxDigest(txid);
  if (cached) return cached;
  const archive = await fetchTxArchive(txid);
  if (!archive) return null;
  const digest = archiveDigest(archive);
  await setTxDigest(txid, digest);
  return digest;
}
