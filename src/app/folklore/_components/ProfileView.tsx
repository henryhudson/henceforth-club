import type { ScoreWindow } from "@/lib/xScore";
import type { RatingTable } from "@/lib/kudos/elo";
import { dedupePosts, type XArchive } from "../parseArchive";
import { Avatar, formatDate, formatUnixSeconds } from "./PostCard";
import { buildPermanenceLine } from "./permanenceLine";
import FeedControls from "./FeedControls";

/**
 * The header card and post feed for a profile. `postCount` is the archive's
 * TRUE total when known (the paginated `/folklore/<handle>` route only hands
 * a first slice); FeedControls pages the rest. `isPreview` picks the
 * permanence line's honest "not yet inscribed" phrasing.
 */
export default function ProfileView({
  archive,
  postCount,
  handle,
  isPreview,
  photoCount,
  txCount,
  archiveSats,
  firstInscribedAt,
  txTimes = {},
  scores = {},
  scoresByWindow,
  foundingByPost,
  verified,
  kudosEnabled = false,
  tipsByPost,
  eloByPost,
  header = "profile",
  defaultMode,
}: {
  archive: XArchive;
  postCount?: number;
  /** Paging handle — when set with postCount, the feed loads the whole archive. */
  handle?: string;
  isPreview: boolean;
  photoCount?: number;
  txCount?: number;
  archiveSats?: number;
  firstInscribedAt?: number;
  txTimes?: Record<string, number>;
  scores?: Record<string, number>;
  scoresByWindow?: Record<ScoreWindow, Record<string, number>>;
  foundingByPost?: Record<string, number>;
  verified?: { bindingPostId: string };
  kudosEnabled?: boolean;
  tipsByPost?: Record<string, number>;
  eloByPost?: RatingTable;
  header?: "profile" | "ledger";
  /** Pass-through for SSR tests that assert Best-tab ranking. */
  defaultMode?: "latest" | "best";
}) {
  const { profile } = archive;
  const posts = dedupePosts(archive.posts);
  const initial = (profile.displayName || profile.handle || "?").charAt(0).toUpperCase();
  const permanenceLine = buildPermanenceLine({
    postCount: postCount ?? posts.length,
    photoCount,
    txCount,
    archiveSats,
    firstInscribedLabel: firstInscribedAt !== undefined ? formatUnixSeconds(firstInscribedAt) : undefined,
    isPreview,
  });

  return (
    <div className="pb-24">
      {/* Header — the identity, said once, over a faint ledger grid */}
      {header === "profile" && (
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
        </div>
      </div>
      )}

      {/* Feed — a ledger: ranked by committed sats by default (Latest/Best
          tabs switch the order), hairline rules between entries, each
          opening in place to reveal its thread and on-chain record. */}
      <div className="mx-auto mt-8 max-w-[68ch] px-6">
        {eloByPost !== undefined ? (
          <>
            <p className="ledger-label mb-1">The ledger · ranked by duels won · tap a post to open it</p>
            <p className="mb-3 text-xs text-muted">
              Posts rank by winning duels in the arena — text, photo, or video. Giving kudos to the
              better of a dealt pair crowns it; a rating is earned against other posts, never bought.
            </p>
          </>
        ) : (
          <>
            <p className="ledger-label mb-1">The ledger · ranked by kudos · tap a post to open it</p>
            <p className="mb-3 text-xs text-muted">
              Posts rank by kudos people paid for them — upload fee never counts. Worth here is
              what others committed, not applause it can&rsquo;t keep.
            </p>
          </>
        )}
        <FeedControls
          posts={posts}
          txTimes={txTimes}
          handle={handle ?? profile.handle}
          postCount={postCount}
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          foundingByPost={foundingByPost}
          scores={scores}
          scoresByWindow={scoresByWindow}
          kudosEnabled={kudosEnabled}
          tipsByPost={tipsByPost}
          eloByPost={eloByPost}
          defaultMode={defaultMode}
        />
      </div>
    </div>
  );
}
