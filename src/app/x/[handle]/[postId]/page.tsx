import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArchivePage, getArchivePost } from "@/lib/xArchiveCache";
import PostCard from "../../_components/PostCard";

// A single archived post, addressable on its own so it can be linked, shared,
// and picked up by a search engine or a social-card preview — instead of
// only being reachable by scrolling through the whole profile. Thread
// context (what this post replies to, and what replies to it) is Task 7's
// job; today this renders just the post itself.

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
  const [post, page] = await Promise.all([
    getArchivePost(handle, postId),
    getArchivePage(handle, 0, 0),
  ]);
  if (!post || !page) notFound();

  return (
    <main className="min-h-screen bg-background pt-16">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PostCard post={post} profile={page.profile} showParent={Boolean(post.parent)} />
        <Link href={`/x/${handle}`} className="mt-6 inline-block text-accent hover:underline">
          &larr; Back to @{handle}
        </Link>
      </div>
    </main>
  );
}
