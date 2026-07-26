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
 * The ranking, in Henry's own definition (2026-07-26): "the satoshis earned
 * plus what it costs to upload." A post's rank IS its total committed value
 * — kudos others paid onto it plus the founding sats its inscription cost —
 * linear, undecayed, one honest number per post. Measured on the witness
 * archive that means: bare text ~15 sats (falling into natural newest-first
 * ties), photos ~8.6k, videos by their real size from ~1.4k for a small
 * reply clip to 2.4 million for the largest, and any kudos lift a post
 * exactly as far as the satoshis say. No freshness term and no damping —
 * value is value; recency only breaks ties (input order is newest-first).
 *
 * The old class constants (video 100, photo 30) survive only as FLOORS for
 * an archive whose founding was never ledgered, so a foreign archive still
 * shows its media before its text rather than collapsing to chronology.
 */
type HotRankable = { media?: ReadonlyArray<{ type: string }> };

export function hotScore(post: HotRankable, kudosSats: number, foundingSats: number): number {
  const classFloor = post.media?.some((m) => m.type === "video")
    ? 100
    : post.media && post.media.length > 0
      ? 30
      : 0;
  return Math.max(0, kudosSats) + Math.max(Math.max(0, foundingSats), classFloor);
}

export function sortPostsByHot<P extends HotRankable & { id: string }>(
  posts: readonly P[],
  scores: Record<string, number>,
  founding: Record<string, number>,
): P[] {
  return posts
    .map((p, i) => ({ p, i, h: hotScore(p, scores[p.id] ?? 0, founding[p.id] ?? 0) }))
    .sort((x, y) => y.h - x.h || x.i - y.i)
    .map((d) => d.p);
}

/** The shop window's seating: the owner's picks lead in their listed order,
 * the given (hot-ranked) order fills the remaining seats. Curation exists
 * because the hot fold cannot tell an expensive casual clip from an
 * expensive tutorial — only the owner can. A pick absent from the posts is
 * skipped, never an error. */
export function showcasePosts<P extends { id: string }>(
  posts: readonly P[],
  picks: readonly string[],
  seats: number,
): P[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const picked = picks.flatMap((id) => (byId.has(id) ? [byId.get(id) as P] : []));
  const chosen = new Set(picked.map((p) => p.id));
  return [...picked, ...posts.filter((p) => !chosen.has(p.id))].slice(0, seats);
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
