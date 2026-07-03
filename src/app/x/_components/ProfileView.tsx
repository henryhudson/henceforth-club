import type { ReactNode } from "react";
import type { XArchive } from "../parseArchive";
import { dedupePosts } from "@/lib/xArchiveCache";
import PostCard, { Avatar, computeShowParent, formatDate, formatUnixSeconds } from "./PostCard";
import { buildPermanenceLine } from "./permanenceLine";

/**
 * The header card and post feed for a profile. `postCount` is the archive's
 * TRUE total post count when known (the paginated `/x/<handle>` route only
 * ever hands this a first slice); it falls back to what's actually in
 * `archive.posts` for the untouched `/x/tx/<txid>` view, which has no
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
}: {
  archive: XArchive;
  postCount?: number;
  footer?: ReactNode;
  isPreview: boolean;
  photoCount?: number;
  txCount?: number;
  firstInscribedAt?: number;
  txTimes?: Record<string, number>;
}) {
  const { profile } = archive;
  const posts = dedupePosts(archive.posts);
  const showParent = computeShowParent(posts);
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
      {/* Header */}
      <div className="mx-auto max-w-2xl px-6">
        <div className="rounded-2xl border border-card-border bg-card-bg p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <Avatar size={64} avatarUrl={profile.avatarUrl} initial={initial} />
            <div>
              <h2 className="text-xl font-bold text-foreground">{profile.displayName ?? profile.handle}</h2>
              <p className="text-accent">@{profile.handle}</p>
            </div>
          </div>
          {profile.bio && <p className="mt-4 text-foreground/90">{profile.bio}</p>}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            {profile.location && <span>{profile.location.trim()}</span>}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {profile.createdAt && <span>Joined {formatDate(profile.createdAt)}</span>}
          </div>
          <p className="mt-4 text-xs text-muted">{permanenceLine}</p>
          <ReadingTabs />
        </div>
      </div>

      {/* Feed — newest first, linear, narrowed to a comfortable reading width */}
      <div className="mx-auto mt-6 max-w-[68ch] px-6">
        <div className="space-y-3">
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              showParent={showParent[i]}
              txTime={post.txid ? txTimes[post.txid] : undefined}
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
