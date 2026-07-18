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
type MediaFilter = "all" | "media" | "video";

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

function isVideoMedia(type: string): boolean {
  const t = type.toLowerCase();
  return t.startsWith("video") || t === "animated_gif";
}

/** Pure: whether a post belongs under a media filter. */
export function postMatchesMediaFilter(post: XPost, filter: MediaFilter): boolean {
  if (filter === "all") return true;
  const media = post.media ?? [];
  if (filter === "media") return media.length > 0;
  return media.some((m) => isVideoMedia(m.type));
}

/**
 * Feed ranking + media filter + infinite scroll in one place.
 * Scroll-loads the full archive in every mode (Latest and Best), re-sorting
 * Best as pages arrive so videos deeper than the first page still surface.
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
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
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

  // Infinite scroll for every mode.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || handle === undefined) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) void loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handle, loadMore]);

  // Media / video filters: keep pulling pages until the archive is fully
  // loaded so the filter can see every post, not just the first page.
  useEffect(() => {
    if (mediaFilter === "all") return;
    if (exhausted || loadingMore || !handle) return;
    void loadMore();
  }, [mediaFilter, exhausted, loadingMore, handle, loadMore, extraPosts.length]);

  const allPosts = [...initialPosts, ...extraPosts];
  const windowScores = scoresByWindow?.[selectedWindow] ?? scores;

  const filtered = allPosts.filter((p) => postMatchesMediaFilter(p, mediaFilter));
  const ordered =
    mode === "best"
      ? eloByPost !== undefined
        ? sortPostsByElo(filtered, eloByPost)
        : sortPostsByScore(filtered, windowScores)
      : filtered;

  const showParent = computeShowParent(ordered);
  const threads = buildThreadContext(ordered);
  const loaded = allPosts.length;
  const mediaCount = allPosts.filter((p) => postMatchesMediaFilter(p, "media")).length;
  const videoCount = allPosts.filter((p) => postMatchesMediaFilter(p, "video")).length;

  return (
    <div>
      <div role="tablist" aria-label="Reading order" className="mb-3 flex flex-wrap gap-2 font-mono text-xs">
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

      <div role="group" aria-label="Media filter" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
        {(
          [
            { value: "all" as const, label: "All", count: loaded },
            { value: "media" as const, label: "Media", count: mediaCount },
            { value: "video" as const, label: "Videos", count: videoCount },
          ] as const
        ).map(({ value, label, count }) => {
          const active = mediaFilter === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setMediaFilter(value)}
              className={
                active
                  ? "border border-accent px-3 py-1.5 text-foreground"
                  : "border border-card-border px-3 py-1.5 text-muted transition-colors hover:border-card-border-hover"
              }
            >
              {label}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
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
        <p className="mt-6 text-center font-mono text-xs text-muted">
          {mediaFilter === "video"
            ? exhausted
              ? "No videos in this archive."
              : "Loading videos from the rest of the archive…"
            : mediaFilter === "media"
              ? exhausted
                ? "No media posts in this archive."
                : "Loading media from the rest of the archive…"
              : "No posts."}
        </p>
      )}

      {handle !== undefined && !exhausted && (
        <div ref={sentinelRef} className="py-6 text-center font-mono text-xs text-muted">
          {loadingMore
            ? `Loading more… ${loaded.toLocaleString("en-GB")} of ${totalKnown.toLocaleString("en-GB")}`
            : mediaFilter !== "all"
              ? `Fetching archive… ${loaded.toLocaleString("en-GB")} of ${totalKnown.toLocaleString("en-GB")}`
              : ""}
        </div>
      )}

      {handle !== undefined && exhausted && totalKnown > initialPosts.length && (
        <p className="mt-4 text-center font-mono text-xs text-muted">
          {loaded.toLocaleString("en-GB")} posts loaded
          {mediaFilter === "video" ? ` · ${videoCount} with video` : ""}
          {mediaFilter === "media" ? ` · ${mediaCount} with media` : ""}
        </p>
      )}
    </div>
  );
}
