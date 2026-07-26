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

/** The shop-window ordering (Henry, 2026-07-26): the archive's costliest
 * artifacts lead — video posts first, then photo posts, then bare text —
 * because a video is the most expensive thing anyone has inscribed and the
 * teaser's plain page order was burying all three of the witness's. Stable
 * within each class, same decorate-sort-undecorate as the score sort. */
export function sortPostsByMediaCost<P extends { media?: ReadonlyArray<{ type: string }> }>(
  posts: readonly P[],
): P[] {
  const cost = (p: P) =>
    p.media?.some((m) => m.type === "video") ? 0 : p.media && p.media.length > 0 ? 1 : 2;
  return posts
    .map((p, i) => ({ p, i, c: cost(p) }))
    .sort((x, y) => x.c - y.c || x.i - y.i)
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
