import type { Metadata } from "next";
import Link from "next/link";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";
import { getOwner } from "@/lib/xOwner";
import { readScores } from "@/lib/xVotes";
import { DEFAULT_WINDOW } from "@/lib/xScore";
import ProfilePage from "../_components/ProfilePage";

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> },
): Promise<Metadata> {
  const { handle } = await params;
  const page = await getArchivePage(handle, 0, 0);
  return page
    ? {
        title: `@${page.profile.handle} — on Bitcoin`,
        description: `${page.profile.displayName ?? page.profile.handle}'s X profile, reclaimed onto Bitcoin — readable forever, even if X goes down.`,
      }
    : { title: `@${handle} — not archived yet` };
}

export default async function HandlePage(
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const page = await getArchivePage(handle, 0, PAGE_SIZE);

  if (!page) {
    return (
      <main className="min-h-screen bg-background pt-28">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">@{handle}</h1>
          <p className="mt-3 text-muted">This profile isn&rsquo;t archived on Bitcoin yet.</p>
          <Link href="/text" className="mt-5 inline-block text-accent hover:underline">
            Archive a profile &rarr;
          </Link>
        </div>
      </main>
    );
  }

  const [owner, scores] = await Promise.all([getOwner(handle), readScores(handle, DEFAULT_WINDOW)]);

  return (
    <ProfilePage
      archive={{ profile: page.profile, posts: page.posts }}
      txid={page.latestTxid}
      postCount={page.postCount}
      handle={handle}
      txCount={page.txCount}
      photoCount={page.photoCount}
      firstInscribedAt={page.firstInscribedAt}
      txTimes={page.txTimes}
      scores={scores}
      verified={owner ? { bindingPostId: owner.bindingPostId } : undefined}
    />
  );
}
