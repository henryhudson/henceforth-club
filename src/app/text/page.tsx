import type { Metadata } from "next";
import Link from "next/link";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";
import { listHandles } from "@/lib/xIndex";
import { readScores } from "@/lib/xVotes";
import { type ScoreWindow } from "@/lib/xScore";
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

export default async function XPage() {
  const witness = await getArchivePage(WITNESS_HANDLE, 0, PAGE_SIZE);
  const handles = await listHandles(50);
  const windows: ScoreWindow[] = ["day", "week", "month", "year", "all"];
  const scoreMaps = await Promise.all(windows.map((w) => readScores(WITNESS_HANDLE, w)));
  const scoresByWindow = Object.fromEntries(windows.map((w, i) => [w, scoreMaps[i]])) as Record<
    ScoreWindow,
    Record<string, number>
  >;

  return (
    // A <div>, not a <main>: the root layout already provides the single <main>
    // landmark for every page (see app/layout.tsx).
    <div className="min-h-screen bg-background pt-16">
      {/* Hero — the thesis, over a faint ledger grid */}
      <header className="ledger-grid relative">
        <div className="mx-auto max-w-2xl px-6 pb-10 pt-14 text-center">
          <p className="ledger-label">Text · permanent on Bitcoin</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            An archive X <span className="text-accent">can&rsquo;t revoke</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Your X profile, written to Bitcoin — readable from any block explorer, forever, and
            without us.
          </p>
          <p className="mt-6 font-mono text-xs text-muted">
            <span className="text-accent">{handles.length}</span>{" "}
            {handles.length === 1 ? "profile" : "profiles"} archived · read from the chain, never from a
            server
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
          firstInscribedAt={witness.firstInscribedAt}
          txTimes={witness.txTimes}
          scoresByWindow={scoresByWindow}
        />
      ) : (
        <p className="mx-auto max-w-2xl px-6 text-center text-muted">
          The witness archive could not be read from Bitcoin just now. It is still there.
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
      <ArchiveDropZone />

      {/* The gateway — two ways in, said once */}
      <section className="mx-auto max-w-2xl px-6 pb-14 text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-sm">
          <Link
            className="rounded-md border border-accent px-4 py-2 text-accent transition-colors hover:bg-accent hover:text-background"
            href="/text/archive"
          >
            Archive yours &rarr;
          </Link>
          <span className="text-muted">or</span>
          <a
            className="rounded-md border border-card-border px-4 py-2 text-foreground transition-colors hover:border-card-border-hover"
            href="https://apps.apple.com/app/henceforth/id1602896145"
          >
            Archive with the app · &pound;9.99
          </a>
        </div>
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
