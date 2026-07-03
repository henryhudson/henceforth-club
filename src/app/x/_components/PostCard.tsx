import type { XPost, XProfile } from "../parseArchive";

export function formatDate(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

// Declared at module scope (not inside a render body) so it isn't re-created —
// and its state reset — on every render. Takes what it needs as props.
export function Avatar({
  size,
  avatarUrl,
  initial,
}: {
  size: number;
  avatarUrl?: string;
  initial: string;
}) {
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full bg-accent/15 font-bold text-accent"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}

/** Whether to render post[i]'s reply-context quote block — a parent tweet's
 * text is shown only once per rendered batch: not if it duplicates another
 * post's own text, and not if an earlier post in the same batch already
 * quoted it. Only the live-preview archive ever carries a `parent`; on-chain
 * archives only carry `replyToId`, so this only affects that preview path. */
export function computeShowParent(posts: XPost[]): boolean[] {
  const postTexts = new Set(posts.map((p) => p.text.trim()));
  const shownParent = new Set<string>();
  return posts.map((p) => {
    if (!p.parent) return false;
    const key = p.parent.text.trim();
    if (postTexts.has(key) || shownParent.has(key)) return false;
    shownParent.add(key);
    return true;
  });
}

/**
 * One archived post as it appears in a profile feed or on its own permalink
 * page — the reply context (when shown), the post itself, and any media.
 * Identical markup wherever it's used, so the server's first page and the
 * client's later ones (and the permalink page) all render the same thing.
 */
export default function PostCard({
  post,
  profile,
  showParent,
}: {
  post: XPost;
  profile: XProfile;
  showParent: boolean;
}) {
  const initial = (profile.displayName || profile.handle || "?").charAt(0).toUpperCase();

  return (
    <article className="rounded-xl border border-card-border bg-card-bg p-4">
      {/* The tweet being replied to */}
      {showParent && post.parent ? (
        <div className="mb-3 rounded-lg border-l-2 border-card-border-hover bg-background/40 px-3 py-2">
          <p className="text-xs font-semibold text-accent">@{post.parent.author}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{post.parent.text}</p>
        </div>
      ) : post.replyToScreenName ? (
        <p className="mb-2 text-xs text-muted">
          ↳ replying to <span className="text-accent">@{post.replyToScreenName}</span>
        </p>
      ) : null}

      {/* The post */}
      <div className="flex gap-3">
        <div className="shrink-0">
          <Avatar size={40} avatarUrl={profile.avatarUrl} initial={initial} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-bold text-foreground">{profile.displayName ?? profile.handle}</span>{" "}
            <span className="text-muted">@{profile.handle} · {formatDate(post.at)}</span>
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/95">{post.text}</p>
          {post.media && post.media.length > 0 && (
            <div className={`mt-3 grid gap-2 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {post.media.map((m, i) =>
                m.type === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={m.url} alt="" className="w-full rounded-lg border border-card-border object-cover" />
                ) : (
                  <video
                    key={i}
                    src={m.url}
                    poster={m.preview}
                    controls
                    playsInline
                    className="w-full rounded-lg border border-card-border"
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
