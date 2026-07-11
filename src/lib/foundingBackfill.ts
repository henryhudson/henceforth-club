import type { Redis } from "@upstash/redis";
import { appendFoundingVote } from "./xVotes";
import { fetchTxFeeSats } from "./whatsonchain";
import { getRedis, dateKey } from "./redis";

type BackfillPost = { id: string; txid?: string };
type BackfillDeps = { feeOf?: (txid: string) => Promise<number | null>; redis?: Redis | null };

export async function backfillFoundingVotes(
  handle: string,
  posts: readonly BackfillPost[],
  txTimes: Record<string, number>,
  deps: BackfillDeps = {},
) {
  const feeOf = deps.feeOf ?? fetchTxFeeSats;
  const redis = deps.redis ?? getRedis();
  let recorded = 0, duplicate = 0, skipped = 0;

  // Group posts by their inscription txid so a shared transaction's fee is
  // split across its posts and fetched once, not once per post.
  const byTxid = new Map<string, BackfillPost[]>();
  for (const post of posts) {
    if (!post.txid) { skipped++; continue; }
    const arr = byTxid.get(post.txid);
    if (arr) arr.push(post); else byTxid.set(post.txid, [post]);
  }

  for (const [txid, txPosts] of byTxid) {
    const fee = await feeOf(txid);
    if (fee === null) { skipped += txPosts.length; continue; }  // fail-open, retry next run
    const perPost = Math.round(fee / txPosts.length);
    const t = txTimes[txid];
    const day = new Date(t != null ? t * 1000 : Date.now()).toISOString().slice(0, 10);
    for (const post of txPosts) {
      const res = await appendFoundingVote(handle,
        { inscriptionTxid: txid, postId: post.id, uploadCostSats: perPost, inscriptionDay: day },
        dateKey(), redis);
      if (res === "recorded") recorded++;
      else if (res === "duplicate") duplicate++;
      else skipped++;
    }
  }
  return { recorded, duplicate, skipped };
}
