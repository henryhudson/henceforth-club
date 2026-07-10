import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArchivePage, getArchivePost, PAGE_SIZE } from "@/lib/xArchiveCache";
import { readScores } from "@/lib/xVotes";
import { DEFAULT_WINDOW } from "@/lib/xScore";
import PostEntry from "../../_components/PostEntry";
import { buildThreadContext } from "../../_components/threadContext";

// A single archived post, addressable on its own so it can be linked, shared,
// and picked up by a search engine or a social-card preview — instead of
// only being reachable by scrolling through the whole profile. It renders
// open, its on-chain record and any in-archive thread context shown.

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string; postId: string }> },
): Promise<Metadata> {
  const { handle, postId } = await params;
  const post = await getArchivePost(handle, postId);
  if (!post) return { title: `@${handle} — post not found` };

  const title = `@${handle} on Bitcoin`;
  const description = post.text.length > 200 ? `${post.text.slice(0, 200)}…` : post.text;
  return { title, description, openGraph: { title, description } };
}

export default async function PostPage(
  { params }: { params: Promise<{ handle: string; postId: string }> },
) {
  const { handle, postId } = await params;
  const [post, page, feed, scores] = await Promise.all([
    getArchivePost(handle, postId),
    getArchivePage(handle, 0, 0),
    getArchivePage(handle, 0, PAGE_SIZE),
    readScores(handle, DEFAULT_WINDOW),
  ]);
  if (!post || !page) notFound();

  // Thread context from the archive's first page — the neighbouring posts this
  // one replies to or that reply to it, when they are on chain too.
  const threadIndex = feed?.posts.findIndex((p) => p.id === post.id) ?? -1;
  const thread = feed && threadIndex >= 0 ? buildThreadContext(feed.posts)[threadIndex] : undefined;

  return (
    <main className="min-h-screen bg-background pt-16">
      <div className="mx-auto max-w-[68ch] px-6 py-8">
        <p className="ledger-label mb-3">
          <Link href={`/text/${handle}`} className="hover:text-accent">
            @{handle}
          </Link>{" "}
          · one entry
        </p>
        <div className="border-t border-card-border">
          <PostEntry
            post={post}
            showParent={Boolean(post.parent)}
            txTime={post.txid ? page.txTimes[post.txid] : undefined}
            thread={thread}
            handle={handle}
            sats={scores[post.id]}
            defaultOpen
          />
        </div>
        <Link href={`/text/${handle}`} className="mt-6 inline-block text-accent hover:underline">
          &larr; Back to @{handle}
        </Link>
      </div>
    </main>
  );
}
