/**
 * Pure. The archive's media views: every post carrying a given media kind.
 * A post with both a video and a photo appears under BOTH kinds — the card
 * renders all of a post's media regardless, so each view answers "where is
 * the media of this kind" rather than partitioning the archive.
 */
export type MediaKind = "video" | "photo";

export function postsWithMedia<P extends { media?: ReadonlyArray<{ type: string }> }>(
  posts: readonly P[],
  kind: MediaKind,
): P[] {
  return posts.filter((post) => post.media?.some((m) => m.type === kind) ?? false);
}
