import { pagesForPostCount, POSTS_PER_PAGE, X_TIMELINE_CEILING } from "./xfetch";

/**
 * How much of a profile a full archive should READ, and what the fee must be
 * priced from. One plan, two consumers: /api/x/quote prices it, /api/x/archive
 * charges and executes it. Both derive from here so the quoted price and the
 * demanded fee cannot drift apart.
 */
export type ArchiveReadPlan = {
  /** Read only posts newer than this id. Absent = no sound watermark, read all. */
  sinceId?: string;
  /** Page budget for the read. */
  maxPages: number;
  /** Posts the fee is priced from. */
  billedPosts: number;
};

/**
 * Pure. `sinceId` must come from lib/xWatermark's `resolveReadBound` — an
 * explicit completeness watermark weighed against the chain — never from any
 * archive-derived maximum (the refuted 2026-07-16 design) and never from the
 * client, who must not get to lower its own bill.
 *
 * Two review-mandated properties of the bounded branch:
 *
 * - THE FULL PAGE BUDGET. The bound does not shrink `maxPages`, because a
 *   budget derived from an estimate of the delta would truncate it when the
 *   estimate deflated (deletions shrink X's lifetime count), and a truncated
 *   delta that later advanced the watermark would be a permanent silent hole.
 *   X bills per resource RETURNED, so the unspent budget beyond the delta
 *   costs nothing.
 * - WORST-CASE PRICING. The fee covers what the page budget PERMITS
 *   (`maxPages * POSTS_PER_PAGE`), never an estimate of what the delta will
 *   return. An estimate can floor near zero while a since-bounded page still
 *   returns 100 real posts X bills us for — priced from the estimate, that
 *   read would bypass the daily budget ledger a hundredfold. The saving from
 *   a bounded read is real but lands on the X bill (resources actually
 *   returned), not on the fee floor.
 */
export function archiveReadPlan(postCount: number, sinceId: string | null): ArchiveReadPlan {
  const maxPages = pagesForPostCount(postCount);
  if (sinceId === null) {
    return { maxPages, billedPosts: Math.min(Math.max(0, postCount), X_TIMELINE_CEILING) };
  }
  return { sinceId, maxPages, billedPosts: maxPages * POSTS_PER_PAGE };
}
