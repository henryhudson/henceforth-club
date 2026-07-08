import type { XArchive } from "./parseArchive";

/**
 * About how many bytes this archive will occupy in an OP_RETURN.
 *
 * The app assembles the real payload, so this is an estimate and the page must
 * say so. It is honest in the way that matters: it counts encoded bytes rather
 * than characters, so an emoji costs what an emoji actually costs.
 */
export function estimateArchiveBytes(archive: XArchive): number {
  if (archive.posts.length === 0) return 0;

  const payload = {
    v: 1,
    source: "x",
    handle: archive.profile.handle,
    profile: archive.profile,
    posts: archive.posts.map((p) => ({ id: p.id, at: p.at, text: p.text, replyToId: p.replyToId })),
  };
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}
