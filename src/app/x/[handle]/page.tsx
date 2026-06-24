import type { Metadata } from "next";
import type { XArchive } from "../parseArchive";
import { socialArchiveToXArchive } from "../onchain";
import { fetchTxArchive } from "@/lib/whatsonchain";
import { getXTxid } from "@/lib/xIndex";
import ProfilePage from "../_components/ProfilePage";
import { realArchive } from "../real";

// Pre-inscription fallbacks (live preview rendered until a handle is indexed
// on-chain). Once a profile is inscribed + registered, the on-chain read wins.
const fallback: Record<string, XArchive> = { henryhudson6: realArchive };

/** handle → archive: the on-chain inscription (via the txid index) first, else preview. */
async function resolve(
  handle: string,
): Promise<{ archive: XArchive; txid: string | null } | null> {
  const txid = await getXTxid(handle);
  if (txid) {
    const sa = await fetchTxArchive(txid);
    if (sa) return { archive: socialArchiveToXArchive(sa), txid };
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
          <a href="/x" className="mt-5 inline-block text-accent hover:underline">
            Archive a profile &rarr;
          </a>
        </div>
      </main>
    );
  }

  return <ProfilePage archive={r.archive} txid={r.txid} />;
}
