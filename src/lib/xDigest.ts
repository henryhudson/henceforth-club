import { getRedis } from "./redis";
import type { SocialArchive } from "@/app/text/onchain";

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

/** Cache a transaction's digest forever (no expiry — the data is immutable). */
export async function setTxDigest(txid: string, digest: TxDigest): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(key(txid), digest);
}
