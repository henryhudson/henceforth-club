"use client";

import { useEffect, useRef, useState } from "react";
import type { XPost } from "../parseArchive";
import { computeShowParent } from "./PostCard";
import PostEntry from "./PostEntry";
import { buildThreadContext } from "./threadContext";

type PostsResponse = {
  posts: XPost[];
  offset: number;
  postCount: number;
  txTimes: Record<string, number>;
};

/**
 * Appends further pages of a profile's posts as the visitor scrolls near the
 * bottom of what the server already rendered. A sentinel element at the foot
 * of the loaded posts triggers the next fetch once it enters the viewport,
 * so nobody downloads posts they never scroll to. `txTimes` starts from the
 * server-rendered page and is refreshed from each response, so a scroll-
 * loaded post's outpoint chip gets the same "on chain since" hover text a
 * server-rendered one does.
 */
export default function PostsScrollLoader({
  handle,
  initialCount,
  postCount,
  initialTxTimes,
  initialScores = {},
}: {
  handle: string;
  initialCount: number;
  postCount: number;
  initialTxTimes: Record<string, number>;
  initialScores?: Record<string, number>;
}) {
  const [posts, setPosts] = useState<XPost[]>([]);
  const [txTimes, setTxTimes] = useState<Record<string, number>>(initialTxTimes);
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
        // A non-OK response (e.g. a transient server error) is exactly as
        // retryable as a thrown network error — fall through to the same
        // "leave the sentinel in place" recovery below rather than
        // permanently exhausting the feed over one bad response.
        if (!res.ok) return;
        const body = (await res.json()) as PostsResponse;
        setPosts((prev) => [...prev, ...body.posts]);
        setTxTimes(body.txTimes);
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
  const threads = buildThreadContext(posts);

  return (
    <>
      <div className="divide-y divide-card-border border-t border-card-border">
        {posts.map((post, i) => (
          <PostEntry
            key={post.id}
            post={post}
            showParent={showParent[i]}
            txTime={post.txid ? txTimes[post.txid] : undefined}
            thread={threads[i]}
            handle={handle}
            sats={initialScores[post.id]}
          />
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
