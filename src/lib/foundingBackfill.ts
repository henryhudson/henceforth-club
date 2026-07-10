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
  for (const post of posts) {
    if (!post.txid) { skipped++; continue; }
    const fee = await feeOf(post.txid);
    if (fee === null) { skipped++; continue; }            // fail-open, retry next run
    const day = new Date(txTimes[post.txid] ?? Date.parse(dateKey())).toISOString().slice(0, 10);
    const res = await appendFoundingVote(handle,
      { inscriptionTxid: post.txid, postId: post.id, uploadCostSats: fee, inscriptionDay: day }, dateKey(), redis);
    if (res === "recorded") recorded++;
    else if (res === "duplicate") duplicate++;
    else skipped++;
  }
  return { recorded, duplicate, skipped };
}
