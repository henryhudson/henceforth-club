import type { ReactNode } from "react";
import { dedupePosts, type XArchive } from "../parseArchive";
import { Avatar, computeShowParent, formatDate, formatUnixSeconds } from "./PostCard";
import PostEntry from "./PostEntry";
import { buildThreadContext } from "./threadContext";
import { buildPermanenceLine } from "./permanenceLine";

/**
 * The header card and post feed for a profile. `postCount` is the archive's
 * TRUE total post count when known (the paginated `/text/<handle>` route only
 * ever hands this a first slice); it falls back to what's actually in
 * `archive.posts` for the untouched `/text/tx/<txid>` view, which has no
 * separate notion of a total. `footer` renders after the feed, inside the
 * same narrowed reading column — the scroll loader mounts there. `isPreview`
 * picks the permanence line's honest "not yet inscribed" phrasing over
 * claims about transactions and inscribing dates a preview doesn't have.
 */
export default function ProfileView({
  archive,
  postCount,
  footer,
  isPreview,
  photoCount,
  txCount,
  firstInscribedAt,
  txTimes = {},
  scores = {},
  verified,
}: {
  archive: XArchive;
  postCount?: number;
  footer?: ReactNode;
  isPreview: boolean;
  photoCount?: number;
  txCount?: number;
  firstInscribedAt?: number;
  txTimes?: Record<string, number>;
  scores?: Record<string, number>;
  verified?: { bindingPostId: string };
}) {
  const { profile } = archive;
  const posts = dedupePosts(archive.posts);
  const showParent = computeShowParent(posts);
  const threads = buildThreadContext(posts);
  const initial = (profile.displayName || profile.handle || "?").charAt(0).toUpperCase();
  const permanenceLine = buildPermanenceLine({
    postCount: postCount ?? posts.length,
    photoCount,
    txCount,
    firstInscribedLabel: firstInscribedAt !== undefined ? formatUnixSeconds(firstInscribedAt) : undefined,
    isPreview,
  });

  return (
    <div className="pb-24">
      {/* Header — the identity, said once, over a faint ledger grid */}
      <div className="mx-auto max-w-2xl px-6">
        <div className="ledger-grid relative overflow-hidden rounded-2xl border border-card-border bg-card-bg p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <Avatar size={64} avatarUrl={profile.avatarUrl} initial={initial} />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-foreground">
                {profile.displayName ?? profile.handle}
              </h2>
              <p className="text-accent">
                @{profile.handle}
                {verified && (
                  <a
                    href={`https://x.com/${profile.handle}/status/${verified.bindingPostId}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Verified — check the binding tweet"
                    className="ml-2 text-xs text-foreground/70 hover:underline"
                  >
                    ✓ Verified
                  </a>
                )}
              </p>
            </div>
          </div>
          {profile.bio && <p className="mt-4 whitespace-pre-wrap text-foreground/90">{profile.bio}</p>}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            {profile.location && <span>{profile.location.trim()}</span>}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {profile.createdAt && <span>Joined {formatDate(profile.createdAt)}</span>}
          </div>
          <p className="mt-5 border-t border-card-border pt-4 font-mono text-xs text-muted">
            {permanenceLine}
          </p>
          <ReadingTabs />
        </div>
      </div>

      {/* Feed — a ledger: newest first, hairline rules between entries, each
          opening in place to reveal its thread and on-chain record. */}
      <div className="mx-auto mt-8 max-w-[68ch] px-6">
        <p className="ledger-label mb-1">The ledger · newest first · tap a post to open it</p>
        <div className="divide-y divide-card-border border-t border-card-border">
          {posts.map((post, i) => (
            <PostEntry
              key={post.id}
              post={post}
              showParent={showParent[i]}
              txTime={post.txid ? txTimes[post.txid] : undefined}
              thread={threads[i]}
              handle={profile.handle}
              sats={scores[post.id]}
            />
          ))}
        </div>
        {footer}
      </div>
    </div>
  );
}

/** Latest / Best as a terminal-style tab strip. Best doesn't exist yet — it
 * arrives with paid votes in a later task — so it renders disabled rather
 * than wired to anything. */
function ReadingTabs() {
  return (
    <div role="tablist" aria-label="Reading order" className="mt-5 flex gap-2 font-mono text-xs">
      <span
        role="tab"
        aria-selected="true"
        className="rounded-md border border-accent px-3 py-1.5 text-foreground"
      >
        Latest
      </span>
      <span
        role="tab"
        aria-selected="false"
        aria-disabled="true"
        title="arrives with paid votes"
        className="cursor-not-allowed rounded-md border border-card-border px-3 py-1.5 text-muted/60"
      >
        Best
      </span>
    </div>
  );
}
