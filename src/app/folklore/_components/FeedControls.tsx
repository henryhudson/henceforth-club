"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_WINDOW, type ScoreWindow } from "@/lib/xScore";
import { ratingOf, type RatingTable } from "@/lib/kudos/elo";
import type { XPost } from "../parseArchive";
import { buildThreadContext } from "./threadContext";
import { computeShowParent } from "./PostCard";
import { sortPostsByElo, sortPostsByScore } from "../sortPosts";
import PostEntry from "./PostEntry";

type Mode = "latest" | "best";

const WINDOWS: ReadonlyArray<{ value: ScoreWindow; label: string }> = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

type PostsResponse = {
  posts: XPost[];
  offset: number;
  postCount: number;
  txTimes: Record<string, number>;
};

/**
 * Feed ranking + infinite scroll. One list — Latest / Best only as sort, no
 * media filter chrome. Pages the full archive so every post is reachable.
 */
export default function FeedControls({
  posts: initialPosts,
  txTimes: initialTxTimes,
  handle,
  postCount,
  avatarUrl,
  displayName,
  foundingByPost = {},
  scores = {},
  scoresByWindow,
  kudosEnabled = false,
  tipsByPost,
  eloByPost,
  defaultMode = "latest",
}: {
  posts: readonly XPost[];
  txTimes: Record<string, number>;
  /** When set with postCount, the feed can page in the rest of the archive. */
  handle?: string;
  postCount?: number;
  avatarUrl?: string;
  displayName?: string;
  foundingByPost?: Record<string, number>;
  scores?: Record<string, number>;
  scoresByWindow?: Record<ScoreWindow, Record<string, number>>;
  kudosEnabled?: boolean;
  tipsByPost?: Record<string, number>;
  eloByPost?: RatingTable;
  /** SSR/tests: production defaults to Latest so the full archive can scroll. */
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [selectedWindow, setSelectedWindow] = useState<ScoreWindow>(DEFAULT_WINDOW);
  const [extraPosts, setExtraPosts] = useState<XPost[]>([]);
  const [txTimes, setTxTimes] = useState<Record<string, number>>(initialTxTimes);
  const [loadingMore, setLoadingMore] = useState(false);
  const totalKnown = postCount ?? initialPosts.length;
  const [exhausted, setExhausted] = useState(
    handle === undefined || initialPosts.length >= totalKnown,
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    offset: initialPosts.length,
    loadingMore: false,
    exhausted: handle === undefined || initialPosts.length >= totalKnown,
  });

  useEffect(() => {
    stateRef.current = {
      offset: initialPosts.length + extraPosts.length,
      loadingMore,
      exhausted,
    };
  });

  const loadMore = useCallback(async () => {
    if (!handle) return;
    const { offset, loadingMore: busy, exhausted: done } = stateRef.current;
    if (busy || done) return;
    setLoadingMore(true);
    stateRef.current.loadingMore = true;
    try {
      const url = `/api/x/posts?handle=${encodeURIComponent(handle)}&offset=${offset}&mode=latest`;
      const res = await fetch(url);
      if (!res.ok) return;
      const body = (await res.json()) as PostsResponse;
      setExtraPosts((prev) => {
        const seen = new Set([...initialPosts, ...prev].map((p) => p.id));
        const fresh = body.posts.filter((p) => !seen.has(p.id));
        return [...prev, ...fresh];
      });
      setTxTimes(body.txTimes);
      const nextOffset = offset + body.posts.length;
      if (body.posts.length === 0 || nextOffset >= body.postCount) {
        setExhausted(true);
        stateRef.current.exhausted = true;
      }
    } catch {
      /* leave sentinel — next intersection retries */
    } finally {
      setLoadingMore(false);
      stateRef.current.loadingMore = false;
    }
  }, [handle, initialPosts]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || handle === undefined) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) void loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handle, loadMore]);

  const allPosts = [...initialPosts, ...extraPosts];
  const windowScores = scoresByWindow?.[selectedWindow] ?? scores;

  const ordered =
    mode === "best"
      ? eloByPost !== undefined
        ? sortPostsByElo(allPosts, eloByPost)
        : sortPostsByScore(allPosts, windowScores)
      : allPosts;

  const showParent = computeShowParent(ordered);
  const threads = buildThreadContext(ordered);
  const loaded = allPosts.length;

  return (
    <div>
      <div role="tablist" aria-label="Reading order" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "latest"}
          onClick={() => setMode("latest")}
          className={
            mode === "latest"
              ? "border border-accent px-3 py-1.5 text-foreground"
              : "border border-card-border px-3 py-1.5 text-muted transition-colors hover:border-card-border-hover"
          }
        >
          Latest
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "best"}
          onClick={() => setMode("best")}
          className={
            mode === "best"
              ? "border border-accent px-3 py-1.5 text-foreground"
              : "border border-card-border px-3 py-1.5 text-muted transition-colors hover:border-card-border-hover"
          }
        >
          Best
        </button>
      </div>

      {mode === "best" && eloByPost === undefined && scoresByWindow && (
        <div role="group" aria-label="Ranking window" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
          {WINDOWS.map(({ value, label }) => {
            const active = value === selectedWindow;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedWindow(value)}
                className={
                  active
                    ? "border border-accent px-3 py-1.5 text-foreground"
                    : "border border-card-border px-3 py-1.5 text-muted transition-colors hover:border-card-border-hover"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="divide-y divide-card-border border-t border-card-border">
        {ordered.map((post, i) => (
          <PostEntry
            key={post.id}
            post={post}
            showParent={showParent[i]}
            txTime={post.txid ? txTimes[post.txid] : undefined}
            thread={threads[i]}
            handle={handle}
            sats={windowScores[post.id]}
            avatarUrl={avatarUrl}
            displayName={displayName}
            foundingSats={foundingByPost[post.id]}
            kudosEnabled={kudosEnabled}
            tipCount={tipsByPost?.[post.id]}
            elo={eloByPost !== undefined ? ratingOf(eloByPost, post.id) : undefined}
          />
        ))}
      </div>

      {ordered.length === 0 && (
        <p className="mt-6 text-center font-mono text-xs text-muted">No posts.</p>
      )}

      {handle !== undefined && !exhausted && (
        <div ref={sentinelRef} className="py-6 text-center font-mono text-xs text-muted">
          {loadingMore
            ? `Loading more… ${loaded.toLocaleString("en-GB")} of ${totalKnown.toLocaleString("en-GB")}`
            : ""}
        </div>
      )}

      {handle !== undefined && exhausted && totalKnown > initialPosts.length && (
        <p className="mt-4 text-center font-mono text-xs text-muted">
          {loaded.toLocaleString("en-GB")} posts loaded
        </p>
      )}
    </div>
  );
}
