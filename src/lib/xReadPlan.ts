import { pagesForPostCount, X_TIMELINE_CEILING } from "./xfetch";

/**
 * How much of a profile a full archive should READ — and therefore bill.
 *
 * One plan, two consumers: /api/x/quote prices it, /api/x/archive charges and
 * executes it. Both MUST derive from here; the day they compute pages or
 * billed posts separately is the day a quote stops matching the fee the gate
 * demands (2026-07-16 — until today, every full re-archive re-read and
 * re-billed the entire reachable timeline because nothing bounded the read).
 */
export type ArchiveReadPlan = {
  /** Read only posts newer than this id. Absent = nothing archived, read all. */
  sinceId?: string;
  /** Page budget for the read — never fewer than one (the probe). */
  maxPages: number;
  /**
   * Posts the fee is priced from. An ESTIMATE — X's postCount is a lifetime
   * figure that drifts with deletions — but quote and gate share the same
   * estimate, so they cannot disagree with each other.
   */
  billedPosts: number;
};

/**
 * The newest archived tweet id, taken numerically. Snowflake ids grow with
 * time but not in length-lockstep, so a lexicographic max would call "999"
 * newer than "10000" — and real ids sit past 2^53, where Number comparison
 * lies too. BigInt or nothing. A non-numeric id is ignored rather than
 * thrown on: one corrupt digest must not brick every future archive.
 */
export function newestTweetId(tweetIds: ReadonlySet<string>): string | null {
  let newest: bigint | null = null;
  let newestRaw: string | null = null;
  for (const id of tweetIds) {
    if (!/^\d+$/.test(id)) continue;
    const n = BigInt(id);
    if (newest === null || n > newest) {
      newest = n;
      newestRaw = id;
    }
  }
  return newestRaw;
}

/**
 * Plan a full-archive read given what X reports and what is already on chain.
 *
 * Nothing archived → the plan is today's behaviour: the whole reachable
 * timeline. Something archived → a since-bounded delta: X returns only posts
 * newer than the bound (and bills per resource RETURNED, so the posts already
 * on chain cost nothing this time). The estimate can floor at zero — deletions
 * shrink postCount below the archived count — in which case the read is a
 * one-page probe and the gate's own +1 resource floor still prices the head.
 */
export function archiveReadPlan(
  postCount: number,
  archivedTweetIds: ReadonlySet<string>,
): ArchiveReadPlan {
  const sinceId = newestTweetId(archivedTweetIds) ?? undefined;
  if (sinceId === undefined) {
    return {
      maxPages: pagesForPostCount(postCount),
      billedPosts: Math.min(Math.max(0, postCount), X_TIMELINE_CEILING),
    };
  }
  const reachable = Math.min(Math.max(0, postCount), X_TIMELINE_CEILING);
  const estimatedNew = Math.max(0, reachable - archivedTweetIds.size);
  return {
    sinceId,
    maxPages: pagesForPostCount(estimatedNew),
    billedPosts: estimatedNew,
  };
}
