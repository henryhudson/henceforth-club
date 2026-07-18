import type { ReactNode } from "react";
import type { ScoreWindow } from "@/lib/xScore";
import type { RatingTable } from "@/lib/kudos/elo";
import { dedupePosts, type XArchive } from "../parseArchive";
import { Avatar, computeShowParent, formatDate, formatUnixSeconds } from "./PostCard";
import { buildThreadContext } from "./threadContext";
import { buildPermanenceLine } from "./permanenceLine";
import FeedControls from "./FeedControls";

/**
 * The header card and post feed for a profile. `postCount` is the archive's
 * TRUE total post count when known (the paginated `/folklore/<handle>` route only
 * ever hands this a first slice); it falls back to what's actually in
 * `archive.posts` for the untouched `/folklore/tx/<txid>` view, which has no
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
}: {
  archive: XArchive;
  postCount?: number;
  footer?: ReactNode;
  isPreview: boolean;
  photoCount?: number;
  txCount?: number;
  /** Total satoshis paid to archive this profile — what permanence cost. */
  archiveSats?: number;
  firstInscribedAt?: number;
  txTimes?: Record<string, number>;
  /** Single flat score table (one window) — what callers not yet wired to
   * the full per-window fetch pass; `FeedControls`' Best mode falls back to
   * this when `scoresByWindow` is absent. */
  scores?: Record<string, number>;
  /** All five windows' score tables. When present, Best mode ranks by
   * whichever window is selected; when absent, Best falls back to `scores`
   * (window-invariant but still real, rather than disabled). */
  scoresByWindow?: Record<ScoreWindow, Record<string, number>>;
  /** Per-post upload costs (the founding entries) — the other half of the
   * chip PostEntry renders; the ranking is founding + earned. */
  foundingByPost?: Record<string, number>;
  verified?: { bindingPostId: string };
  /** Threaded from the server's per-request KUDOS_ENABLED read — text rows
   * carry the kudos control only behind it. */
  kudosEnabled?: boolean;
  /** Public tip counts by post id, from the server's bulk read. */
  tipsByPost?: Record<string, number>;
  /** The duel-rating table, threaded only while the kudos flag is on — the
   * Best tab then sorts by Elo (the decayed-fold windows retire from the
   * sort) and each row wears its rating or the unranked badge. Absent, the
   * decayed-fold sort stands unchanged. */
  eloByPost?: RatingTable;
  /** "profile" (default) opens with the identity card — the profile page's
   * whole point. "ledger" skips it: on the landing every entry is signed by
   * its author (picture + name linking to the profile), so a card up top
   * would say the same thing twice. */
  header?: "profile" | "ledger";
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
            <p className="ledger-label mb-1">The ledger · ranked by committed sats · tap a post to open it</p>
            <p className="mb-3 text-xs text-muted">
              Posts earn sats through paid votes from the Henceforth app — a post&rsquo;s worth here is
              what people committed to it, not applause it can&rsquo;t keep.
            </p>
          </>
        )}
        <FeedControls
          posts={posts}
          showParent={showParent}
          threads={threads}
          txTimes={txTimes}
          handle={profile.handle}
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          foundingByPost={foundingByPost}
          scores={scores}
          scoresByWindow={scoresByWindow}
          kudosEnabled={kudosEnabled}
          tipsByPost={tipsByPost}
          eloByPost={eloByPost}
          footer={footer}
        />
      </div>
    </div>
  );
}
