import type { Metadata } from "next";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";
import ProfilePage from "./_components/ProfilePage";
import ArchiveDropZone from "./_components/ArchiveDropZone";
import { WITNESS_HANDLE } from "./witness";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "An archive X can't revoke",
  description:
    "Your X profile, written to Bitcoin. Readable from any block explorer, forever, without us.",
};

export default async function XPage() {
  const witness = await getArchivePage(WITNESS_HANDLE, 0, PAGE_SIZE);

  return (
    <main className="min-h-screen bg-background pt-20">
      <header className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Reclaimed from X
        </p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">An archive X can&rsquo;t revoke</h1>
        <p className="mt-2 text-sm text-muted">Because we never asked X for permission.</p>
      </header>

      {witness ? (
        <ProfilePage
          archive={{ profile: witness.profile, posts: witness.posts }}
          txid={witness.latestTxid}
          postCount={witness.postCount}
          handle={WITNESS_HANDLE}
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

      <ArchiveDropZone />
    </main>
  );
}
