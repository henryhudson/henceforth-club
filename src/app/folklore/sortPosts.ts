// Pure ordering for the ranked feed: a post list and a score table in, the
// same posts back out in score-descending order. Missing scores fold to 0
// (an unscored post ranks with the untouched middle, not last); ties keep
// their original relative order (decorate-sort-undecorate on the input
// index) so a reorder never looks arbitrary between equally-scored posts.

import { ratingOf, type RatingTable } from "@/lib/kudos/elo";

export function sortPostsByScore<P extends { id: string }>(
  posts: readonly P[],
  scores: Record<string, number>,
): P[] {
  return posts
    .map((p, i) => ({ p, i, s: scores[p.id] ?? 0 }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .map((d) => d.p);
}

/** The Elo ordering the kudos flag turns on: rating descending, with a
 * never-dueled text at the start rating (the untouched middle, exactly like
 * the score sort's 0), and ties stable on the input order. */
export function sortPostsByElo<P extends { id: string }>(
  posts: readonly P[],
  table: RatingTable,
): P[] {
  return posts
    .map((p, i) => ({ p, i, r: ratingOf(table, p.id).rating }))
    .sort((x, y) => y.r - x.r || x.i - y.i)
    .map((d) => d.p);
}

/**
 * The hot fold (Henry, 2026-07-26: "we need the hot feed… it's all about the
 * algorithm"). Three terms, each with a job:
 *
 *   paid   = 80 · log₁₀(1 + sats)      — earned kudos rank first, log-damped
 *            so the first satoshis move a post most and one whale cannot
 *            freeze the feed forever. Founding (upload cost) is already
 *            excluded upstream by the score fold.
 *   prior  = video 100 · photo 30      — the cold-start shelf: before anyone
 *            has voted, the archive's own economics rank it (a video is the
 *            costliest thing anyone inscribed). Supersedes the earlier
 *            media-cost sort, which was this prior with no other terms.
 *   fresh  = 200 · e^(−ageDays/14)     — a new post outranks a bare video for
 *            roughly its first fortnight (at 14 days: ~74, under the video
 *            prior), then settles to where kudos and media put it. This is
 *            what lets a weekly delta surface on arrival and sink honestly.
 *
 * Reference points: 1,000 sats ≈ 240 (beats everything unpaid); a fresh text
 * post starts at 200; a video floor is 100. `now` is injected so the fold
 * stays pure; a post whose `at` does not parse counts as old (fresh 0),
 * never as new. Ties keep input order (newest-first from the archive).
 */
type HotRankable = { at?: string; media?: ReadonlyArray<{ type: string }> };

export function hotScore(post: HotRankable, sats: number, nowMs: number): number {
  const paid = 80 * Math.log10(1 + Math.max(0, sats));
  const prior = post.media?.some((m) => m.type === "video")
    ? 100
    : post.media && post.media.length > 0
      ? 30
      : 0;
  const atMs = post.at === undefined ? NaN : Date.parse(post.at);
  const ageDays = Number.isNaN(atMs) ? Infinity : Math.max(0, (nowMs - atMs) / 86_400_000);
  const fresh = 200 * Math.exp(-ageDays / 14);
  return paid + prior + fresh;
}

export function sortPostsByHot<P extends HotRankable & { id: string }>(
  posts: readonly P[],
  scores: Record<string, number>,
  nowMs: number,
): P[] {
  return posts
    .map((p, i) => ({ p, i, h: hotScore(p, scores[p.id] ?? 0, nowMs) }))
    .sort((x, y) => y.h - x.h || x.i - y.i)
    .map((d) => d.p);
}

/** The directory's ordering under the kudos flag: rated authors first by
 * their aggregate rating descending, then the unrated in the order given
 * (which is the existing newest-stamped order — the flag-off directory).
 * An author aggregate exists only once the ledger has rated a text of
 * theirs, so with no duels this is the identity. */
export function sortHandlesByAuthorElo<H extends { handle: string }>(
  handles: readonly H[],
  ratings: Record<string, number>,
): H[] {
  return handles
    .map((h, i) => ({ h, i, r: ratings[h.handle] }))
    .sort((x, y) => {
      if (x.r === undefined && y.r === undefined) return x.i - y.i;
      if (x.r === undefined) return 1;
      if (y.r === undefined) return -1;
      return y.r - x.r || x.i - y.i;
    })
    .map((d) => d.h);
}
