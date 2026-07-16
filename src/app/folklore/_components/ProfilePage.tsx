import type { XArchive } from "../parseArchive";
import type { ScoreWindow } from "@/lib/xScore";
import ProfileView from "./ProfileView";
import PostsScrollLoader from "./PostsScrollLoader";
import ReaderKeys from "./ReaderKeys";

/**
 * Shared profile page shell used by both `/folklore/<handle>` and `/folklore/tx/<txid>`.
 * When `txid` is present the profile was read from Bitcoin and we link the
 * transaction; otherwise it's a pre-inscription live preview. `postCount`
 * and `handle` are only set by the paginated `/folklore/<handle>` route — when the
 * archive holds more posts than are rendered yet, a scroll loader appends
 * the rest as the visitor scrolls, and `j`/`k`/`o` become available.
 * `txCount`, `photoCount`, `firstInscribedAt`, and `txTimes` feed the header's
 * permanence line and each post card's outpoint chip.
 */
export default function ProfilePage({
  archive,
  txid,
  postCount,
  handle,
  txCount,
  photoCount,
  archiveSats,
  firstInscribedAt,
  txTimes = {},
  scores = {},
  scoresByWindow,
  foundingByPost,
  verified,
}: {
  archive: XArchive;
  txid?: string | null;
  postCount?: number;
  handle?: string;
  txCount?: number;
  photoCount?: number;
  archiveSats?: number;
  firstInscribedAt?: number;
  txTimes?: Record<string, number>;
  scores?: Record<string, number>;
  scoresByWindow?: Record<ScoreWindow, Record<string, number>>;
  foundingByPost?: Record<string, number>;
  verified?: { bindingPostId: string };
}) {
  const scrollLoader =
    handle !== undefined && postCount !== undefined && postCount > archive.posts.length ? (
      <PostsScrollLoader
        handle={handle}
        initialCount={archive.posts.length}
        postCount={postCount}
        initialTxTimes={txTimes}
        initialScores={scores}
        avatarUrl={archive.profile.avatarUrl}
        displayName={archive.profile.displayName}
        foundingByPost={foundingByPost}
      />
    ) : undefined;

  return (
    <main className="min-h-screen bg-background pt-16">
      <header className="mx-auto max-w-2xl px-6 py-8 text-center">
        <p className="ledger-label">Reclaimed from X · {txid ? "on Bitcoin" : "preview"}</p>
        {txid ? (
          <a
            href={`https://whatsonchain.com/tx/${txid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block break-all font-mono text-[11px] text-accent hover:underline"
          >
            {txid.slice(0, 16)}&hellip;{txid.slice(-8)} &#8599;
          </a>
        ) : (
          <p className="mt-2 font-mono text-[11px] text-muted">
            Not yet inscribed &mdash; live preview from X
          </p>
        )}
      </header>
      <ProfileView
        archive={archive}
        postCount={postCount}
        footer={scrollLoader}
        isPreview={!txid}
        photoCount={photoCount}
        txCount={txCount}
        archiveSats={archiveSats}
        firstInscribedAt={firstInscribedAt}
        txTimes={txTimes}
        scores={scores}
        scoresByWindow={scoresByWindow}
        foundingByPost={foundingByPost}
        verified={verified}
      />
      <ReaderKeys handle={handle} />
    </main>
  );
}
