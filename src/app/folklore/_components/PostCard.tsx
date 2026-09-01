import type { XPost } from "../parseArchive";
import { fullResXAvatar } from "../xAvatar";

// Shared, pure presentation helpers for the reading room. The interactive
// post row lives in PostEntry.tsx (a client component); these are the
// stateless pieces it and the profile header both build from, kept here with
// no "use client" so server components (DirectoryRow, ProfileView) can import
// them directly.

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

/** The first six and last four hex characters of a txid, for the outpoint
 * chip — matching how block explorers usually elide a long hash. */
export { shortTxid } from "../shortTxid";

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
      src={fullResXAvatar(avatarUrl)}
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
