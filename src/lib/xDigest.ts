import { getRedis } from "./redis";
import type { SocialArchive } from "@/app/folklore/onchain";

// Per-transaction digest cache. An archive transaction is immutable, so the
// digest derived from it can be cached forever — the archived endpoint then
// never has to re-download the raw transaction (up to hundreds of kilobytes
// today; media transactions run to megabytes and exceed Next's fetch cache).

/** What one archive transaction contributes to the on-chain record: every post
 * id it carries, and the ids of posts whose media it inscribes. */
export type TxDigest = { tweetIds: string[]; mediaPostIds: string[] };

const key = (txid: string) => `x:txdigest:${txid}`;

/** Pure: derive a transaction's digest from its parsed archive. */
export function archiveDigest(archive: SocialArchive): TxDigest {
  return {
    tweetIds: archive.posts.map((p) => p.id),
    mediaPostIds: archive.posts.filter((p) => p.mediaHashes?.length).map((p) => p.id),
  };
}

/** The cached digest for a transaction, or null on a cache miss (or no redis). */
export async function getTxDigest(txid: string): Promise<TxDigest | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get<TxDigest>(key(txid))) ?? null;
}

/**
 * Digests for many transactions in one round trip. A miss is absent from the
 * map, same as the single read's null — the caller decides what an unknown
 * digest means rather than being handed a zero that reads like a fact.
 */
export async function getTxDigests(txids: string[]): Promise<Map<string, TxDigest>> {
  const redis = getRedis();
  const found = new Map<string, TxDigest>();
  if (!redis || txids.length === 0) return found;
  const values = await redis.mget<Array<TxDigest | null>>(...txids.map(key));
  txids.forEach((txid, i) => {
    const digest = values[i];
    if (digest) found.set(txid, digest);
  });
  return found;
}

/** Cache a transaction's digest forever (no expiry — the data is immutable). */
export async function setTxDigest(txid: string, digest: TxDigest): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(key(txid), digest);
}
