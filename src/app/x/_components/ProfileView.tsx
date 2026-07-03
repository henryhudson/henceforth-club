import type { ReactNode } from "react";
import type { XArchive } from "../parseArchive";
import { dedupePosts } from "@/lib/xArchiveCache";
import PostCard, { Avatar, computeShowParent, formatDate } from "./PostCard";

/**
 * The header card and post feed for a profile. `postCount` is the archive's
 * TRUE total post count when known (the paginated `/x/<handle>` route only
 * ever hands this a first slice); it falls back to what's actually in
 * `archive.posts` for the untouched `/x/tx/<txid>` view, which has no
 * separate notion of a total. `footer` renders after the feed, inside the
 * same centred column — the scroll loader mounts there.
 */
export default function ProfileView({
  archive,
  postCount,
  footer,
}: {
  archive: XArchive;
  postCount?: number;
  footer?: ReactNode;
}) {
  const { profile } = archive;
  const posts = dedupePosts(archive.posts);
  const showParent = computeShowParent(posts);
  const initial = (profile.displayName || profile.handle || "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24">
      {/* Header */}
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
          <span>{postCount ?? posts.length} posts shown</span>
        </div>
      </div>

      {/* Feed — newest first, linear */}
      <div className="mt-6 space-y-3">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} profile={profile} showParent={showParent[i]} />
        ))}
      </div>
      {footer}
    </div>
  );
}
