import type { Redis } from "@upstash/redis";
import { appendFoundingVote } from "./xVotes";
import { fetchTxFeeSats } from "./whatsonchain";
import { getRedis, dateKey } from "./redis";

type BackfillPost = {
  id: string;
  txid?: string;
  /** The post's byte weight inside its transaction — text bytes plus its
   * media bytes. When every post sharing a txid carries a positive weight,
   * the fee splits proportionally (a 3 MB video post bears its true share,
   * a 40-byte text post bears its own); otherwise the split falls back to
   * equal, the pre-2026-07-12 behaviour. */
  weight?: number;
};
type BackfillDeps = { feeOf?: (txid: string) => Promise<number | null>; redis?: Redis | null };

/**
 * Split `fee` across `weights` proportionally, in whole satoshis that sum to
 * EXACTLY `fee` — largest-remainder rounding, ties to the earlier index so
 * the result is deterministic. All-zero (or empty) weights fall back to an
 * equal split with the remainder spread one satoshi at a time from the
 * front. Money math: no satoshi is invented or lost by rounding. Pure.
 */
export function splitFeeByWeights(fee: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  const effective = total > 0 ? weights.map((w) => Math.max(0, w)) : weights.map(() => 1);
  const effectiveTotal = total > 0 ? total : n;

  const exact = effective.map((w) => (fee * w) / effectiveTotal);
  const floors = exact.map(Math.floor);
  let remainder = fee - floors.reduce((s, v) => s + v, 0);

  // Largest fractional part gets the next leftover satoshi.
  const order = exact
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
    out[order[k].i] += 1;
  }
  return out;
}

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
    const shares = splitFeeByWeights(fee, txPosts.map((p) => p.weight ?? 0));
    const t = txTimes[txid];
    const day = new Date(t != null ? t * 1000 : Date.now()).toISOString().slice(0, 10);
    for (let i = 0; i < txPosts.length; i++) {
      const res = await appendFoundingVote(handle,
        { inscriptionTxid: txid, postId: txPosts[i].id, uploadCostSats: shares[i], inscriptionDay: day },
        dateKey(), redis);
      if (res === "recorded") recorded++;
      else if (res === "duplicate") duplicate++;
      else skipped++;
    }
  }
  return { recorded, duplicate, skipped };
}
