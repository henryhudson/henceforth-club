import type { XPost } from "../parseArchive";

/**
 * The thread a post belongs to, reconstructed from the posts visible in one
 * archive. An X archive holds only the account's OWN posts, so the honest
 * "thread" is the self-conversation: the post this one replied to (when that
 * post is also in the archive) and the posts that reply to this one. Other
 * people's replies were never inscribed, so they are never claimed here.
 */
export interface ThreadContext {
  /** The post this one replies to, when it is present in the same archive. */
  parent?: XPost;
  /** Posts in the same archive that reply to this one, newest-first as given. */
  replies: XPost[];
}

/**
 * Build one ThreadContext per post, index-aligned with the input array (the
 * same order the feed renders). Pure — links posts by `replyToId` within the
 * given set only; a reply that lives on a not-yet-loaded page simply isn't
 * linked until it loads.
 */
export function buildThreadContext(posts: XPost[]): ThreadContext[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const repliesByParent = new Map<string, XPost[]>();
  for (const p of posts) {
    if (!p.replyToId) continue;
    const existing = repliesByParent.get(p.replyToId);
    if (existing) existing.push(p);
    else repliesByParent.set(p.replyToId, [p]);
  }
  return posts.map((p) => ({
    parent: p.replyToId ? byId.get(p.replyToId) : undefined,
    replies: repliesByParent.get(p.id) ?? [],
  }));
}
