// Parses an X (Twitter) data-export into a renderable profile + post feed.
// Pure: strips the `window.YTD.<name>.partN = [ … ]` JS wrapper, JSON-parses,
// and maps the fields we display. Replies keep WHO was replied to
// (`in_reply_to_screen_name`) — the parent comment's text is not in the export.

export interface XProfile {
  handle: string;
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface XPost {
  id: string;
  at: string;
  text: string;
  replyToScreenName?: string;
  replyToId?: string;
  media?: Array<{ type: string; url: string; preview?: string }>;
  parent?: { author: string; text: string };
  /** The transaction whose archive carried this post's newest copy. Absent
   * for a preview-archive post, which was never inscribed. */
  txid?: string;
}

export interface XArchive {
  profile: XProfile;
  posts: XPost[];
}

// Drop the `window.YTD.<name>.partN = ` prefix (up to and including the first
// `=`) and any trailing `;`, leaving a JSON array to parse.
function unwrap(js: string): unknown {
  const eq = js.indexOf("=");
  if (eq === -1) throw new Error("unrecognized X export (no assignment)");
  let json = js.slice(eq + 1).trim();
  if (json.endsWith(";")) json = json.slice(0, -1);
  return JSON.parse(json);
}

/**
 * Drop a duplicate post by trimmed text, keeping the first occurrence. Posts
 * arrive newest-first, so the kept copy is always the newest one. Doing this
 * once, before chunking or rendering, is what keeps a page offset meaning
 * the same thing every time it's read — re-deduplicating on every render
 * would silently shift indices as soon as reads were paged. Lives here (a
 * pure module with no side-effectful imports) rather than in `xArchiveCache`
 * so a component that only needs this can't accidentally pull in Redis,
 * on-chain fetching, or anything else that module depends on.
 */
export function dedupePosts(posts: XPost[]): XPost[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    const key = p.text.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseArchive(
  tweetsJS: string,
  profileJS: string,
  accountJS: string,
): XArchive {
  const tweets = unwrap(tweetsJS) as Array<{ tweet: Record<string, string> }>;
  const profiles = unwrap(profileJS) as Array<{
    profile: { description?: Record<string, string>; avatarMediaUrl?: string };
  }>;
  const accounts = unwrap(accountJS) as Array<{ account: Record<string, string> }>;

  const account = accounts[0]?.account;
  if (!account) throw new Error("account.js had no account record");
  const xp = profiles[0]?.profile;

  const profile: XProfile = {
    handle: account.username,
    displayName: account.accountDisplayName,
    bio: xp?.description?.bio,
    location: xp?.description?.location,
    website: xp?.description?.website,
    avatarUrl: xp?.avatarMediaUrl,
    createdAt: account.createdAt,
  };

  const posts: XPost[] = tweets.map(({ tweet: t }) => ({
    id: t.id_str,
    at: t.created_at,
    text: t.full_text,
    replyToScreenName: t.in_reply_to_screen_name ?? undefined,
    replyToId: t.in_reply_to_status_id_str ?? undefined,
  }));

  return { profile, posts };
}
