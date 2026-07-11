// Pure ordering for the ranked feed: a post list and a score table in, the
// same posts back out in score-descending order. Missing scores fold to 0
// (an unscored post ranks with the untouched middle, not last); ties keep
// their original relative order (decorate-sort-undecorate on the input
// index) so a reorder never looks arbitrary between equally-scored posts.

export function sortPostsByScore<P extends { id: string }>(
  posts: readonly P[],
  scores: Record<string, number>,
): P[] {
  return posts
    .map((p, i) => ({ p, i, s: scores[p.id] ?? 0 }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .map((d) => d.p);
}
