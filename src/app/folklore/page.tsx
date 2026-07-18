import type { Metadata } from "next";
import Link from "next/link";
import { getArchivePage } from "@/lib/xArchiveCache";
import { listHandles } from "@/lib/xIndex";
import { gbpPerBsv } from "@/lib/xPrice";
import { readFoundingTotal, readLedgerRollup } from "@/lib/xVotes";
import { readTipCounts } from "@/lib/kudos/tips";
import FolkloreWordmark from "./_components/FolkloreWordmark";
import FolkloreForest from "./_components/FolkloreForest";
import ProfileView from "./_components/ProfileView";
import ArchiveDropZone from "./_components/ArchiveDropZone";
import DirectoryRow from "./_components/DirectoryRow";
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

export default async function FolklorePage() {
  // The web archive flow hides behind its go-live flag; until it is on, the
  // primary action must not lead to a stub that tells a warmed-up visitor to
  // leave (the accent button did exactly that — the top finding of the
  // 2026-07-14 smoothness research).
  const webArchiveOpen = process.env.XTEXT_WEB_ARCHIVE_ENABLED === "true";
  const witness = await getArchivePage(WITNESS_HANDLE, 0, WITNESS_TEASER_POSTS);
  const handles = await listHandles(50);
  // One ledger read, five folds — readScores per window re-read the ledger
  // each time. Shared with /folklore/<handle>, which now carries the same toggle.
  const { scoresByWindow, foundingByPost } = await readLedgerRollup(WITNESS_HANDLE);
  // One ledger read, not one per handle. This used to fan readFoundingTotal
  // across every handle in the directory to sum a site-wide total for the
  // hero's stats line; with that line gone, the witness is the only total the
  // page still shows, so reading fifty ledgers to use one of them was pure
  // cost. Restore the fan-out only if a site-wide figure comes back.
  const witnessSats = await readFoundingTotal(WITNESS_HANDLE);
  // The kudos flag, read the same way as the web-archive flag above — the
  // witness rows carry the kudos control only behind it.
  const kudosEnabled = process.env.KUDOS_ENABLED === "true";
  const tipsByPost =
    kudosEnabled && witness
      ? await readTipCounts(witness.posts.map((post) => post.id))
      : undefined;

  return (
    // A <div>, not a <main>: the root layout already provides the single <main>
    // landmark for every page (see app/layout.tsx).
    <div className="min-h-screen bg-background pt-16">
      {/* The mark and its tagline, and nothing else. The archive IS the
          argument — a stranger should meet real posts read from the chain
          before they meet a pitch, which is the whole finding of the
          2026-07-14 research. The ways in are said once, in the gateway
          below, rather than sold twice. */}
      <header className="relative overflow-hidden">
        <FolkloreForest />
        <div className="relative z-10 mx-auto max-w-2xl px-6 pb-16 pt-16 text-center">
          {/* The wordmark IS the heading — the thesis <h1> that used to carry
              that job left with the banner, and a page with no <h1> strands
              anyone navigating by headings. The mark's aria-label supplies the
              accessible name, so this reads as "Folklore, heading level 1". */}
          <h1>
            <FolkloreWordmark className="mx-auto h-auto w-full max-w-[220px] text-accent sm:max-w-[280px]" />
          </h1>
          <p className="ledger-label mt-5">content secured</p>
          {/* Henry's line, verbatim — the product in one sentence, and the
              only human copy the hero carries. */}
          <p className="mx-auto mt-4 max-w-md text-muted">
            Talk to descendants about information your ancestors desired to pass on.
          </p>
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
          isPreview={false}
          txCount={witness.txCount}
          photoCount={witness.photoCount}
          archiveSats={witnessSats}
          firstInscribedAt={witness.firstInscribedAt}
          txTimes={witness.txTimes}
          scoresByWindow={scoresByWindow}
          foundingByPost={foundingByPost}
          kudosEnabled={kudosEnabled}
          tipsByPost={tipsByPost}
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

      {/* The directory — who has archived, an on-chain ledger stamped by the
          registration gate */}
      <section className="mx-auto max-w-2xl px-6 pb-24">
        <div className="flex items-baseline justify-between">
          <h2 className="ledger-label">The ledger · who has archived</h2>
          <span className="font-mono text-[11px] text-muted">{handles.length} on chain</span>
        </div>
        {handles.length > 0 ? (
          <div className="mt-3 divide-y divide-card-border border-y border-card-border">
            {handles.map(({ handle, latestMs }) => (
              <DirectoryRow key={handle} handle={handle} latestMs={latestMs} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Nobody has archived yet. Be the first entry.</p>
        )}
      </section>
    </div>
  );
}
