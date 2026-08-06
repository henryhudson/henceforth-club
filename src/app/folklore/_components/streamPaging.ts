// Pure paging arithmetic for the server streams (hot / latest), kept out of
// FeedControls so the cursor rules are testable without a DOM.
//
// Each stream keeps a SERVER cursor (`served`) separate from what is shown.
// The server ranks its whole archive and slices by offset, so the only
// offset that never skips a post is the count of posts the server has
// already served to this client — not the count on screen. The two differ
// whenever the seed is CURATED (a hand-picked subset, not the stream's own
// head — the front page's showcase seats) and whenever a fetched page
// overlaps posts already shown: duplicates are dropped from display but
// still advance the cursor, because the server served them. Offsetting by
// the shown count instead is exactly the bug this file closes — a curated
// seed of six made paging start at server rank seven, so a genuinely hot
// post outside the picks could never appear.

export type StreamState<P> = { extra: P[]; served: number; exhausted: boolean };

/** Where a stream starts. A seed in SERVER order is the stream's own head,
 * so its posts count as served; a curated seed is seating, not the stream —
 * the cursor stays at the top and the seed only deduplicates. */
export function initialStreamState<P>(args: {
  pageable: boolean;
  seeded: boolean;
  curatedSeed: boolean;
  seedCount: number;
  totalKnown: number;
}): StreamState<P> {
  return {
    extra: [],
    served: args.seeded && !args.curatedSeed ? args.seedCount : 0,
    exhausted: !args.pageable || (args.seeded && args.seedCount >= args.totalKnown),
  };
}

/** Fold one fetched page into a stream: drop what is already shown, advance
 * the cursor by the WHOLE page (duplicates included — the server served
 * them), and judge exhaustion by the cursor against the archive total, never
 * by the shown count. */
export function absorbPage<P extends { id: string }>(
  state: StreamState<P>,
  shownIds: ReadonlySet<string>,
  page: readonly P[],
  postCount: number,
): StreamState<P> {
  return {
    extra: [...state.extra, ...page.filter((p) => !shownIds.has(p.id))],
    served: state.served + page.length,
    exhausted: page.length === 0 || state.served + page.length >= postCount,
  };
}
