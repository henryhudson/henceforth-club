import { txExplorerUrl } from "@/lib/explorer";
import type { XArchive } from "../parseArchive";
import type { ScoreWindow } from "@/lib/xScore";
import type { RatingTable } from "@/lib/kudos/elo";
import ProfileView from "./ProfileView";
import ReaderKeys from "./ReaderKeys";

/**
 * Shared profile page shell used by both `/folklore/<handle>` and `/folklore/tx/<txid>`.
 * FeedControls pages the full archive when `handle` + `postCount` are set.
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
  kudosEnabled = false,
  tipsByPost,
  eloByPost,
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
  kudosEnabled?: boolean;
  tipsByPost?: Record<string, number>;
  eloByPost?: RatingTable;
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto max-w-2xl px-6 py-8 text-center">
        <p className="ledger-label">Reclaimed from X · {txid ? "on Bitcoin" : "preview"}</p>
        {txid ? (
          <a
            href={txExplorerUrl(txid)}
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
        {txid && handle && (
          <p className="mt-3">
            <a
              href={`/folklore/${handle}/export`}
              download
              className="font-mono text-[11px] text-muted transition-colors hover:text-accent hover:underline"
            >
              download this archive &darr; JSON, yours to keep
            </a>
          </p>
        )}
      </header>
      <ProfileView
        archive={archive}
        postCount={postCount}
        handle={handle}
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
        kudosEnabled={kudosEnabled}
        tipsByPost={tipsByPost}
        eloByPost={eloByPost}
      />
      {handle && <ReaderKeys handle={handle} />}
    </main>
  );
}
