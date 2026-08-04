import type { Metadata } from "next";
import Link from "next/link";
import { getHotArchivePage } from "@/lib/xHotFeed";
import { listHandles, readHandleCards } from "@/lib/xIndex";
import { gbpPerBsv } from "@/lib/xPrice";
import { readFoundingTotal, readLedgerRollup } from "@/lib/xVotes";
import { readTipCounts } from "@/lib/kudos/tips";
import { readRatingTable } from "@/lib/kudos/ledger";
import { readAuthorRatings } from "@/lib/kudos/candidates";
import { boardTop, commentCount, readLinkRecord } from "@/lib/folkloreBoard";
import { showcasePosts, sortHandlesByAuthorElo } from "./sortPosts";
import {
  linkTxidsOf,
  mergeBoard,
  unresolvedProfileHandles,
  withUnlistedHandles,
  type LinkResolution,
} from "./boardMerge";
import FolkloreWordmark from "./_components/FolkloreWordmark";
import FolkloreForest from "./_components/FolkloreForest";
import ProfileView from "./_components/ProfileView";
import ArchiveDropZone from "./_components/ArchiveDropZone";
import DirectoryRow from "./_components/DirectoryRow";
import { readDirectoryRows } from "./_components/directoryRows";
import LinkCard from "./_components/LinkCard";
import Proof from "./_components/Proof";
import { WITNESS_HANDLE } from "./witness";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "An archive X can't revoke",
  description:
    "Your X profile, written to Bitcoin. Readable from any block explorer, forever, without us.",
};

/** How much of the witness archive the index shows. The index sells; the
 * full-feed experience lives at /folklore/<handle>. Thirty posts buried the
 * conversion section under roughly four thousand words of one man's tweets. */
const WITNESS_TEASER_POSTS = 6;

/** The owner's picks for the shop window, in seating order: the Starting
 * Henceforth tutorials, Sci Fri, and the defining-feature film. Post ids
 * from the witness archive; a pick that leaves the archive is skipped. */
const WITNESS_PICKS: readonly string[] = [
  "2074559038046499111", // stack, stack, stacks — episode nine
  "2075673639404380160", // Sci Fri — Kepler's laws
  "2071892336502567016", // get loopy — episode eight
  "2070542548825727443", // decisions ×3 — episode seven
  "2067547024258396270", // words from words — the defining feature
  "2069372485687005271", // episode 6 — printing and ascii
];

/**
 * How many rows the front page considers, on both reads.
 *
 * One number for the board window and the directory read because the page
 * shows one list and that list has one length — not because the two windows
 * hold the same handles. They cannot: the directory is ordered by
 * registration time and the board by kudos, so equal sizes still cut
 * different people. An earlier version of this comment reasoned from the
 * sizes alone and concluded the reads were kept in step; they never were, and
 * a board member the directory window cut used to render nowhere at all. The
 * page closes that separately, by looking the missing cards up by name
 * (`unresolvedProfileHandles`) instead of hoping the windows agree.
 *
 * What a short board window costs is rank, not presence: a profile the board
 * did not return is appended at score zero by `withUnlistedHandles` rather
 * than hidden.
 */
const BOARD_WINDOW = 100;

export default async function FolklorePage() {
  // The web archive flow hides behind its go-live flag; until it is on, the
  // primary action must not lead to a stub that tells a warmed-up visitor to
  // leave (the accent button did exactly that — the top finding of the
  // 2026-07-14 smoothness research).
  const webArchiveOpen = process.env.XFOLKLORE_WEB_ARCHIVE_ENABLED === "true";
  // The whole archive, hot-ranked, then CURATED: the owner's picks — the
  // tutorials, which are why the showroom exists — hold the front seats,
  // and the hot fold fills the rest. Curation is honest here because the
  // fold cannot tell an expensive casual clip from an expensive tutorial;
  // only the owner can (Henry, 2026-07-26: "i dont see my tutorials").
  const witnessWhole = await getHotArchivePage(WITNESS_HANDLE, 0, 100_000);
  const witnessWindow = witnessWhole
    ? {
        ...witnessWhole,
        posts: showcasePosts(witnessWhole.posts, WITNESS_PICKS, WITNESS_TEASER_POSTS),
      }
    : null;
  const handles = await listHandles(BOARD_WINDOW);
  // One ledger read, five folds — readScores per window re-read the ledger
  // each time. Shared with /folklore/<handle>, which now carries the same toggle.
  const { scoresByWindow, foundingByPost } = await readLedgerRollup(WITNESS_HANDLE);
  const witness = witnessWindow;
  // One ledger read, not one per handle. This used to fan readFoundingTotal
  // across every handle in the directory to sum a site-wide total for the
  // hero's stats line; with that line gone, the witness is the only total the
  // page still shows, so reading fifty ledgers to use one of them was pure
  // cost. Restore the fan-out only if a site-wide figure comes back.
  const witnessSats = await readFoundingTotal(WITNESS_HANDLE);
  // Elo / arena stay behind the flag; tip counts load so the in-feed like
  // can show its tally either way.
  const kudosEnabled = process.env.KUDOS_ENABLED === "true";
  const tipsByPost = witness
    ? await readTipCounts(witness.posts.map((post) => post.id))
    : undefined;
  // Behind the flag the duel fold sorts the folklore: the witness feed's Best
  // tab by each text's rating, the directory by the author aggregate. Without
  // it neither table is read and both orders stand exactly as they are.
  const eloByPost = kudosEnabled ? await readRatingTable() : undefined;
  const directoryHandles =
    eloByPost !== undefined
      ? sortHandlesByAuthorElo(handles, await readAuthorRatings(eloByPost))
      : handles;
  // The unified board: profile and link cards in one kudos ranking, then every
  // directory handle the board did not account for appended beneath it. The
  // board is an opinion about the chain, never the authority on who has
  // archived — so a handle it has not learned of still gets its card, and a
  // board holding only links still renders the directory.
  const boardEntries = await boardTop(BOARD_WINDOW);
  const linkRecords = new Map<string, LinkResolution>(
    (
      await Promise.all(
        linkTxidsOf(boardEntries).map(async (txid) => {
          // A card the store cannot resolve — absent, delisted, or a brief
          // outage — simply does not render, exactly as before: the feed
          // drops what it cannot show rather than failing the whole page.
          const read = await readLinkRecord(txid);
          return read.kind === "record"
            ? ([txid, { record: read.record, comments: await commentCount(txid) }] as const)
            : null;
        }),
      )
    ).flatMap((pair) => (pair ? [pair] : [])),
  );
  // Resolution and the appended tail are two different jobs, and one array was
  // doing both badly. The TAIL must stay page-sized — it is the directory
  // section, and reading a thousand handles would print a thousand rows.
  // RESOLUTION must cover every profile the board ranks, wherever it sits in
  // registration order, or that archiver's card is not demoted but absent.
  // Only resolution grows, and only by the names actually missing: while every
  // board handle is inside the directory window — the whole of today — this
  // reads nothing extra at all.
  const rescuedHandles = unresolvedProfileHandles(boardEntries, handles);
  const resolvableHandles =
    rescuedHandles.length > 0 ? [...handles, ...(await readHandleCards(rescuedHandles))] : handles;
  const boardRows = withUnlistedHandles(
    mergeBoard(boardEntries, resolvableHandles, linkRecords),
    directoryHandles,
  );
  // Every profile row's data in four round trips rather than four per row —
  // the rows are known now, and none of their reads depend on another's.
  const directoryData = await readDirectoryRows(
    boardRows.flatMap((row) => (row.kind === "profile" ? [row.handle] : [])),
  );
  // Whether the section is a kudos-ranked board or still just the ledger of
  // who has archived is decided by whether any LINK is on it — not by whether
  // the board zset happens to be non-empty, which was never the same question.
  const hasLinks = boardRows.some((row) => row.kind === "link");

  return (
    // A <div>, not a <main>: the root layout already provides the single <main>
    // landmark for every page (see app/layout.tsx).
    <div className="min-h-screen bg-background">
      {/* Wordmark, then straight into the live archive — the posts are the pitch. */}
      {/* min-h gives the forest a proper stage under the wordmark before the feed. */}
      <header className="relative min-h-[min(52vh,28rem)] overflow-hidden">
        <FolkloreForest />
        <div className="relative z-10 mx-auto flex min-h-[min(52vh,28rem)] max-w-2xl flex-col items-center justify-center px-6 pb-12 pt-20 text-center">
          {/* The wordmark IS the heading — the thesis <h1> that used to carry
              that job left with the banner, and a page with no <h1> strands
              anyone navigating by headings. The mark's aria-label supplies the
              accessible name, so this reads as "Folklore, heading level 1". */}
          <h1>
            <FolkloreWordmark className="mx-auto h-auto w-full max-w-[220px] text-accent sm:max-w-[280px]" />
          </h1>
          <p className="ledger-label mt-5">content secured</p>
        </div>
      </header>

      {/* A live example, read from Bitcoin at request time */}
      <div className="mx-auto max-w-2xl px-6">
        <p className="ledger-label mb-3 text-center">A live archive, read from the chain right now</p>
      </div>
      {witness ? (
        <ProfileView
          archive={{ profile: witness.profile, posts: witness.posts }}
          postCount={witness.postCount}
          handle={WITNESS_HANDLE}
          isPreview={false}
          txCount={witness.txCount}
          photoCount={witness.photoCount}
          archiveSats={witnessSats}
          firstInscribedAt={witness.firstInscribedAt}
          defaultMode="hot"
          txTimes={witness.txTimes}
          scoresByWindow={scoresByWindow}
          foundingByPost={foundingByPost}
          kudosEnabled={kudosEnabled}
          tipsByPost={tipsByPost}
          eloByPost={eloByPost}
          header="ledger"
        />
      ) : (
        <p className="mx-auto max-w-2xl px-6 text-center text-muted">
          The witness archive could not be read from Bitcoin just now. It is still there.
        </p>
      )}

      {witness && (
        <p className="mx-auto -mt-16 max-w-2xl px-6 pb-10 text-center font-mono text-sm">
          <Link className="text-accent hover:underline" href={`/folklore/${WITNESS_HANDLE}`}>
            read the full {witness.postCount.toLocaleString("en-GB")}-post archive &rarr;
          </Link>
        </p>
      )}

      {witness?.latestTxid && <Proof txid={witness.latestTxid} />}

      {/* The stakes — one line, no theatrics */}
      <p className="mx-auto max-w-2xl px-6 text-center text-foreground">
        X&rsquo;s terms let them remove all of it, without telling you why.
      </p>
      <p className="mx-auto max-w-2xl px-6 pt-6 text-center text-sm text-muted">
        Ask X for your archive. It takes about a day. That&rsquo;s how much of it is yours.
      </p>

      {/* Recognition and price — the drop zone renders the quote once a file is parsed */}
      <ArchiveDropZone gbpPerBsv={await gbpPerBsv()} />

      {/* The gateway — the ways in, said once, honestly */}
      <section className="mx-auto max-w-2xl px-6 pb-14 text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-sm">
          {webArchiveOpen && (
            <>
              <Link
                className="rounded-md border border-accent px-4 py-2 text-accent transition-colors hover:bg-accent hover:text-background"
                href="/folklore/archive"
              >
                Archive yours &rarr;
              </Link>
              <span className="text-muted">or</span>
            </>
          )}
          <a
            className={
              webArchiveOpen
                ? "rounded-md border border-card-border px-4 py-2 text-foreground transition-colors hover:border-card-border-hover"
                : "rounded-md border border-accent px-4 py-2 text-accent transition-colors hover:bg-accent hover:text-background"
            }
            href="https://apps.apple.com/app/henceforth/id1602896145"
          >
            Archive with the app &middot; &pound;9.99
          </a>
        </div>
        <p className="mt-3 text-xs text-muted">
          {webArchiveOpen
            ? "Web: £2 + inscription cost per archive, text only. App: £9.99 once, includes photos and videos, keys stay yours."
            : "The web flow — upload your X export, pay £2 + inscription cost by code — arrives shortly. The app archives today: photos and videos included, keys stay yours."}
        </p>
        <p className="mt-4 text-xs text-muted">
          Everything on this page is read from Bitcoin; the site holds pointers, never the text.
        </p>
      </section>

      {/* One section, always: the board's kudos ranking first, then every
          archiver the board has not accounted for. Nobody who paid for a card
          can lose it to a link being submitted. */}
      <section className="mx-auto max-w-2xl px-6 pb-24">
        <div className="flex items-baseline justify-between">
          <h2 className="ledger-label">
            {hasLinks
              ? "The board · archives and links · ranked by kudos"
              : eloByPost !== undefined
                ? "The ledger · who has archived · ranked by duels won"
                : "The ledger · who has archived"}
          </h2>
          <span className="font-mono text-[11px] text-muted">{boardRows.length} on chain</span>
        </div>
        {boardRows.length > 0 ? (
          <div className="mt-3 divide-y divide-card-border border-y border-card-border">
            {boardRows.map((row) =>
              row.kind === "profile" ? (
                <DirectoryRow
                  key={`profile:${row.handle}`}
                  handle={row.handle}
                  latestMs={row.latestMs}
                  data={
                    directoryData.get(row.handle) ?? { latestTxid: null, verified: false }
                  }
                />
              ) : (
                <LinkCard
                  key={`link:${row.txid}`}
                  txid={row.txid}
                  record={row.record}
                  kudos={row.score}
                  comments={row.comments}
                />
              ),
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Nobody has archived yet. Be the first entry.</p>
        )}
      </section>
    </div>
  );
}
