"use client";

import { useEffect, useRef, useState } from "react";
import type { XPost, XProfile } from "../parseArchive";
import PostCard, { computeShowParent } from "./PostCard";

type PostsResponse = { posts: XPost[]; offset: number; postCount: number };

/**
 * Appends further pages of a profile's posts as the visitor scrolls near the
 * bottom of what the server already rendered. A sentinel element at the foot
 * of the loaded posts triggers the next fetch once it enters the viewport,
 * so nobody downloads posts they never scroll to.
 */
export default function PostsScrollLoader({
  handle,
  profile,
  initialCount,
  postCount,
}: {
  handle: string;
  profile: XProfile;
  initialCount: number;
  postCount: number;
}) {
  const [posts, setPosts] = useState<XPost[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(initialCount >= postCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // A mutable snapshot the observer callback reads, so the observer itself
  // doesn't need to be torn down and rebuilt on every state change.
  const stateRef = useRef({ offset: initialCount, loadingMore, exhausted });
  useEffect(() => {
    stateRef.current = { offset: initialCount + posts.length, loadingMore, exhausted };
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    async function loadMore() {
      const { offset, loadingMore, exhausted } = stateRef.current;
      if (loadingMore || exhausted) return;
      setLoadingMore(true);
      try {
        const url = `/api/x/posts?handle=${encodeURIComponent(handle)}&offset=${offset}&mode=latest`;
        const res = await fetch(url);
        if (!res.ok) {
          setExhausted(true);
          return;
        }
        const body = (await res.json()) as PostsResponse;
        setPosts((prev) => [...prev, ...body.posts]);
        if (body.posts.length === 0 || offset + body.posts.length >= body.postCount) {
          setExhausted(true);
        }
      } catch {
        // A flaky fetch just leaves the sentinel in place — the next scroll
        // intersection retries rather than getting stuck failed forever.
      } finally {
        setLoadingMore(false);
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handle]);

  const showParent = computeShowParent(posts);

  return (
    <>
      <div className="mt-3 space-y-3">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} profile={profile} showParent={showParent[i]} />
        ))}
      </div>
      {!exhausted && (
        <div ref={sentinelRef} className="py-6 text-center text-xs text-muted">
          {loadingMore ? "Loading more…" : ""}
        </div>
      )}
    </>
  );
}
