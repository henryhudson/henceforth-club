import type { Metadata } from "next";
import Link from "next/link";
import type { XArchive } from "../parseArchive";
import { socialArchiveToXArchive, stitchArchives, type SocialArchive } from "../onchain";
import { fetchTxArchive } from "@/lib/whatsonchain";
import { getXTxids } from "@/lib/xIndex";
import ProfilePage from "../_components/ProfilePage";
import { realArchive } from "../real";

// Pre-inscription fallbacks (live preview rendered until a handle is indexed
// on-chain). Once a profile is inscribed + registered, the on-chain read wins.
const fallback: Record<string, XArchive> = { henryhudson6: realArchive };

/** handle → archive: the on-chain inscription (via the txid index) first, else preview. */
async function resolve(
  handle: string,
): Promise<{ archive: XArchive; txid: string | null } | null> {
  const txids = await getXTxids(handle);
  if (txids.length > 0) {
    const archives = (await Promise.all(txids.map((t) => fetchTxArchive(t)))).filter(
      (a): a is SocialArchive => a !== null,
    );
    if (archives.length > 0) {
      // Media outpoints resolve against the latest txid; today's archives are
      // text-only, so multi-archive media stitching is deferred.
      const latestTxid = txids[txids.length - 1];
      return {
        archive: socialArchiveToXArchive(stitchArchives(archives), latestTxid),
        txid: latestTxid,
      };
    }
  }
  const fb = fallback[handle.toLowerCase()];
  return fb ? { archive: fb, txid: null } : null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> },
): Promise<Metadata> {
  const { handle } = await params;
  const r = await resolve(handle);
  return r
    ? {
        title: `@${r.archive.profile.handle} — on Bitcoin`,
        description: `${r.archive.profile.displayName ?? r.archive.profile.handle}'s X profile, reclaimed onto Bitcoin — readable forever, even if X goes down.`,
      }
    : { title: `@${handle} — not archived yet` };
}

export default async function HandlePage(
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const r = await resolve(handle);

  if (!r) {
    return (
      <main className="min-h-screen bg-background pt-28">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">@{handle}</h1>
          <p className="mt-3 text-muted">This profile isn&rsquo;t archived on Bitcoin yet.</p>
          <Link href="/x" className="mt-5 inline-block text-accent hover:underline">
            Archive a profile &rarr;
          </Link>
        </div>
      </main>
    );
  }

  return <ProfilePage archive={r.archive} txid={r.txid} />;
}
