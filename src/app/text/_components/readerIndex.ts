/**
 * The reading room's `j`/`k` navigation has no notion of a "current" post
 * until the reader presses one of those keys for the first time — there is
 * no post already focused, so `current` is null. In that state, both the
 * first `j` and the first `k` should land on the very first post: `j`
 * because that is the natural start of reading forward, and `k` for the same
 * reason there is nothing "above" the first post to step back to. Once a
 * post is focused, `j`/`k` step forward/backward from it, clamped to the
 * list's bounds so repeated presses at either end simply stay put.
 */
export function advanceIndex(current: number | null, direction: 1 | -1, count: number): number {
  if (count <= 0) return 0;
  if (current === null) return 0;
  return Math.min(Math.max(current + direction, 0), count - 1);
}
