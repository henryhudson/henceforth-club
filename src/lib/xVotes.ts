import type { Redis } from "@upstash/redis";
import { dateKey, getRedis } from "./redis";
import { foldScores, windowStartDay, DEFAULT_WINDOW, type ScoreWindow, type VoteLedgerEntry } from "./xScore";

// The Redis edge of the paid-vote model — thin on purpose; all scoring logic
// lives in xScore.ts. Two keys per the design:
//
//   x:ledger:<handle>   append-only vote ledger, oldest first
//   x:vote:tx:<txid>    set-if-absent gate: a funding transaction counts once
//
// Windows shift daily, so a precomputed score cache would go stale between
// votes. readScores folds the ledger on read instead — always correct, cheap
// at current volume — so a correction (a double-spent funding transaction
// struck from the ledger) is a replay, never a patch. Null-Redis safe like
// xIndex.ts.

const ledgerKey = (handle: string) => `x:ledger:${handle.toLowerCase()}`;
const voteTxKey = (txid: string) => `x:vote:tx:${txid}`;
const foundingKey = (handle: string, postId: string) =>
  `x:vote:founding:${handle.toLowerCase()}:${postId}`;

export type AppendVoteResult = "recorded" | "duplicate" | "unavailable";

export type FoundingVote = {
  inscriptionTxid: string; postId: string; uploadCostSats: number; inscriptionDay: string;
};

/** The whole vote ledger for a handle, oldest first. Empty when nobody has
 * voted — or when Redis isn't configured. */
export async function readVoteLedger(
  handle: string,
  redis: Redis | null = getRedis(),
): Promise<VoteLedgerEntry[]> {
  if (!redis) return [];
  return redis.lrange<VoteLedgerEntry>(ledgerKey(handle), 0, -1);
}

/**
 * Append a verified vote to the handle's ledger. The `x:vote:tx:<txid>`
 * set-if-absent gate makes a funding transaction count exactly once,
 * globally — a replayed txid is a duplicate, not a second vote. The gate is
 * claimed before the append: if the append then fails the vote is missed
 * (and healed by the daily reconcile), which on a money path beats the
 * reverse order's risk of counting twice.
 */
export async function appendVote(
  handle: string,
  entry: VoteLedgerEntry,
  asOfDay: string = dateKey(),
  redis: Redis | null = getRedis(),
): Promise<AppendVoteResult> {
  if (!redis) return "unavailable";
  const claimed = await redis.set(voteTxKey(entry.txid), "1", { nx: true });
  if (claimed === null) return "duplicate";
  await redis.rpush(ledgerKey(handle), entry);
  return "recorded";
}

/**
 * Append a founding vote to the handle's ledger, gated so a post has at most one.
 * Claims the per-post gate first, so the post is dedup'd even across two different
 * inscription txids. The founding vote is recorded as an up-vote of the upload cost.
 */
export async function appendFoundingVote(
  handle: string, fv: FoundingVote,
  asOfDay: string = dateKey(), redis: Redis | null = getRedis(),
): Promise<AppendVoteResult> {
  if (!redis) return "unavailable";
  const claimedPost = await redis.set(foundingKey(handle, fv.postId), fv.inscriptionTxid, { nx: true });
  if (claimedPost === null) return "duplicate"; // this post already has a founding vote
  const entry: VoteLedgerEntry = {
    txid: fv.inscriptionTxid, postId: fv.postId, dir: "up",
    sats: fv.uploadCostSats, day: fv.inscriptionDay,
  };
  return appendVote(handle, entry, asOfDay, redis); // reuses the txid gate + append
}

/** The earned-sats score for every voted post of a handle within the chosen
 * window, folded from the ledger as of `asOfDay`: a map of post id → sats.
 * Sats can be negative when down-votes outweigh up-votes — the fold is a
 * signed sum. Empty when nobody has voted, or when Redis isn't configured.
 * Null-Redis safe like the rest of this module. */
export async function readScores(
  handle: string,
  window: ScoreWindow = DEFAULT_WINDOW,
  asOfDay: string = dateKey(),
  redis: Redis | null = getRedis(),
): Promise<Record<string, number>> {
  if (!redis) return {};
  const ledger = await readVoteLedger(handle, redis);
  return foldScores(ledger, asOfDay, windowStartDay(window, asOfDay));
}
