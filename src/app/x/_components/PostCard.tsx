import type { XPost } from "../parseArchive";

function formatDateObj(d: Date): string {
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDate(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return formatDateObj(d);
}

/** The same date format as `formatDate`, for a unix-seconds timestamp — the
 * shape a transaction's confirmation time comes in. Used for the outpoint
 * chip's hover text and the profile header's permanence line. */
export function formatUnixSeconds(seconds?: number): string {
  if (seconds === undefined) return "";
  return formatDateObj(new Date(seconds * 1000));
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

/** The first six and last four hex characters of a txid, for the outpoint
 * chip — matching how block explorers usually elide a long hash. */
function shortTxid(txid: string): string {
  return `${txid.slice(0, 6)}…${txid.slice(-4)}`;
}

/**
 * One archived post as it appears in a profile feed or on its own permalink
 * page. The reading room reads like a book, not a feed: no avatar, name, or
 * handle repeated on every post — this is one person's profile, said once in
 * the header. Just the reply context when present, the text (the largest
 * thing on the page), any media, and one quiet line naming when it was
 * posted and where it lives on chain. Identical markup wherever it's used,
 * so the server's first page, the client's scroll-loaded ones, and the
 * permalink page all render the same thing.
 */
export default function PostCard({
  post,
  showParent,
  txTime,
}: {
  post: XPost;
  showParent: boolean;
  txTime?: number;
}) {
  return (
    <article
      id={`post-${post.id}`}
      data-post-id={post.id}
      tabIndex={-1}
      className="rounded-xl border border-card-border bg-card-bg p-4 transition-shadow"
    >
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

      {/* The post itself — the largest, loosest text on the page */}
      <p className="whitespace-pre-wrap text-base leading-loose text-foreground/95">{post.text}</p>

      {/* Media, each in a fixed-ratio frame so nothing shifts while it loads */}
      {post.media && post.media.length > 0 && (
        <div className={`mt-4 grid gap-2 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.media.map((m, i) =>
            m.type === "photo" ? (
              <a
                key={i}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-[4/3] overflow-hidden rounded-lg border border-card-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </a>
            ) : (
              <video
                key={i}
                src={m.url}
                poster={m.preview}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-lg border border-card-border"
              />
            ),
          )}
        </div>
      )}

      {/* One quiet line: when, and where it lives on chain */}
      <p className="mt-3 text-xs text-muted">
        {formatDate(post.at)}
        {post.txid && (
          <>
            {" · "}
            <a
              href={`https://whatsonchain.com/tx/${post.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              title={
                txTime !== undefined
                  ? `on chain since ${formatUnixSeconds(txTime)}`
                  : "inscribed on Bitcoin"
              }
              className="transition-colors hover:text-accent hover:underline"
            >
              ⛓ {shortTxid(post.txid)}
            </a>
          </>
        )}
      </p>
    </article>
  );
}
