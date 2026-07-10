import type { Metadata } from "next";
import Link from "next/link";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";
import { listHandles } from "@/lib/xIndex";
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

  return (
    // A <div>, not a <main>: the root layout already provides the single <main>
    // landmark for every page (see app/layout.tsx). The homepage and app pages all
    // follow this — a page that adds its own <main> nests a second landmark, which
    // is invalid and confuses screen-reader navigation.
    <div className="min-h-screen bg-background pt-20">
      <header className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Reclaimed from X
        </p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">An archive X can&rsquo;t revoke</h1>
        <p className="mt-2 text-sm text-muted">Because we never asked X for permission.</p>
      </header>

      {witness ? (
        // The inner view, not the ProfilePage shell: ProfilePage brings its own
        // <main> and header, which would nest a second landmark inside this page's
        // <main> and repeat the "Reclaimed from X" eyebrow. It also mounts the
        // infinite-scroll loader and reader-key navigation, which belong on the
        // dedicated /text/<handle> reading route — here they would fight the spine
        // that carries the visitor down to the drop zone. The block-explorer proof
        // is not lost: it is the Proof block below.
        <ProfileView
          archive={{ profile: witness.profile, posts: witness.posts }}
          postCount={witness.postCount}
          isPreview={false}
          txCount={witness.txCount}
          photoCount={witness.photoCount}
          firstInscribedAt={witness.firstInscribedAt}
          txTimes={witness.txTimes}
        />
      ) : (
        <p className="mx-auto max-w-2xl px-6 text-center text-muted">
          The witness archive could not be read from Bitcoin just now. It is still there.
        </p>
      )}

      {/* Proof — only when there is a transaction to point at */}
      {witness?.latestTxid && <Proof txid={witness.latestTxid} />}

      {/* Risk — one sentence, no theatrics */}
      <p className="mx-auto max-w-2xl px-6 text-center text-foreground">
        X&rsquo;s terms let them remove all of it, without telling you why.
      </p>

      {/* Invitation — the wait is the argument */}
      <p className="mx-auto max-w-2xl px-6 pt-6 text-center text-sm text-muted">
        Ask X for your archive. It takes about a day. That&rsquo;s how much of it is yours.
      </p>

      {/* Recognition and price — the drop zone renders the quote once a file is parsed */}
      <ArchiveDropZone />

      {/* The app */}
      <p className="mx-auto max-w-2xl px-6 py-10 text-center text-sm text-muted">
        Inscribing needs a wallet and a key that is yours.{" "}
        <a
          className="text-accent hover:underline"
          href="https://apps.apple.com/app/henceforth/id1602896145"
        >
          Henceforth, &pound;9.99
        </a>
      </p>

      {/* The gateway — the app pointer above archives today; this is the web
          path arriving in a later task */}
      <header className="mx-auto max-w-2xl px-6 pb-10 text-center">
        <p className="text-sm text-muted">
          <a
            className="text-accent hover:underline"
            href="https://apps.apple.com/app/henceforth/id1602896145"
          >
            Archive with the app
          </a>
          {" · "}
          <Link className="text-accent hover:underline" href="/text/archive">
            Archive yours &rarr;
          </Link>
        </p>
        <p className="mt-2 text-xs text-muted">
          Everything below is read from Bitcoin; this page holds pointers, never the text.
        </p>
      </header>

      {/* The directory — who has uploaded, stamped by the registration gate */}
      <section className="mx-auto max-w-2xl px-6 pb-20">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Who has archived
        </h2>
        {handles.length > 0 ? (
          <div className="mt-4 divide-y divide-card-border rounded-2xl border border-card-border bg-card-bg">
            {handles.map(({ handle, latestMs }) => (
              <DirectoryRow key={handle} handle={handle} latestMs={latestMs} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Nobody has registered yet. Be first.</p>
        )}
      </section>
    </div>
  );
}
