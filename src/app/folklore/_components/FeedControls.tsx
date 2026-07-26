"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_WINDOW, type ScoreWindow } from "@/lib/xScore";
import { ratingOf, type RatingTable } from "@/lib/kudos/elo";
import type { XPost } from "../parseArchive";
import { buildThreadContext } from "./threadContext";
import { computeShowParent } from "./PostCard";
import { sortPostsByElo, sortPostsByScore } from "../sortPosts";
import PostEntry from "./PostEntry";

type Mode = "hot" | "latest" | "best" | "videos" | "photos";
type StreamMode = "hot" | "latest";
type MediaMode = "videos" | "photos";
const isMediaMode = (m: Mode): m is MediaMode => m === "videos" || m === "photos";
const isStreamMode = (m: Mode): m is StreamMode => m === "hot" || m === "latest";

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
 * The feed's reading orders. Hot and Latest are SERVER streams, each paged
 * independently — the server ranks (hot) or pages (latest) the whole archive
 * and the client only appends, because a client-side reorder over
 * incrementally-loaded pages can only ever rank what happened to be scrolled
 * past. The default stream's first page arrives server-rendered; the other
 * stream starts empty and pages from the top on first opening. Best is a
 * client sort over every post loaded so far (both streams, deduplicated) —
 * a view of the loaded subset, which its footer does not pretend otherwise.
 * Videos / Photos fetch their complete match list in one request (the
 * server scans the whole archive).
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
  /** The tab the feed opens on. "hot" ONLY where the initial posts arrived
   * hot-ranked from the server — the seeded stream must match its order. */
  defaultMode?: Mode;
}) {
  const seededStream: StreamMode = isStreamMode(defaultMode) ? defaultMode : "latest";
  const totalKnown = postCount ?? initialPosts.length;
  const pageable = handle !== undefined;

  const [mode, setMode] = useState<Mode>(defaultMode);
  const [selectedWindow, setSelectedWindow] = useState<ScoreWindow>(DEFAULT_WINDOW);
  const [streams, setStreams] = useState<Record<StreamMode, { extra: XPost[]; exhausted: boolean }>>({
    hot: { extra: [], exhausted: !pageable || (seededStream === "hot" && initialPosts.length >= totalKnown) },
    latest: { extra: [], exhausted: !pageable || (seededStream === "latest" && initialPosts.length >= totalKnown) },
  });
  const [mediaPosts, setMediaPosts] = useState<Partial<Record<MediaMode, XPost[]>>>({});
  const [mediaLoading, setMediaLoading] = useState(false);
  const [txTimes, setTxTimes] = useState<Record<string, number>>(initialTxTimes);
  const [loadingMore, setLoadingMore] = useState(false);

  const streamPosts = useCallback(
    (stream: StreamMode, state: Record<StreamMode, { extra: XPost[]; exhausted: boolean }>) =>
      stream === seededStream ? [...initialPosts, ...state[stream].extra] : state[stream].extra,
    [initialPosts, seededStream],
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ streams, loadingMore });
  useEffect(() => {
    stateRef.current = { streams, loadingMore };
  });

  const loadMore = useCallback(
    async (stream: StreamMode) => {
      if (!handle) return;
      const { streams: current, loadingMore: busy } = stateRef.current;
      if (busy || current[stream].exhausted) return;
      const offset = streamPosts(stream, current).length;
      setLoadingMore(true);
      stateRef.current.loadingMore = true;
      try {
        const url = `/api/x/posts?handle=${encodeURIComponent(handle)}&offset=${offset}&mode=${stream}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const body = (await res.json()) as PostsResponse;
        setStreams((prev) => {
          const seen = new Set(streamPosts(stream, prev).map((p) => p.id));
          const fresh = body.posts.filter((p) => !seen.has(p.id));
          const grown = {
            ...prev,
            [stream]: {
              extra: [...prev[stream].extra, ...fresh],
              exhausted:
                body.posts.length === 0 ||
                streamPosts(stream, prev).length + body.posts.length >= body.postCount,
            },
          };
          stateRef.current.streams = grown;
          return grown;
        });
        setTxTimes(body.txTimes);
      } catch {
        /* leave sentinel — next intersection retries */
      } finally {
        setLoadingMore(false);
        stateRef.current.loadingMore = false;
      }
    },
    [handle, streamPosts],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !pageable || !isStreamMode(mode)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) void loadMore(mode);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pageable, mode, loadMore]);

  const openStreamMode = useCallback(
    (next: StreamMode) => {
      setMode(next);
      if (streamPosts(next, stateRef.current.streams).length === 0) void loadMore(next);
    },
    [loadMore, streamPosts],
  );

  const openMediaMode = useCallback(
    async (next: MediaMode) => {
      setMode(next);
      if (!handle || mediaPosts[next] !== undefined) return;
      setMediaLoading(true);
      try {
        const res = await fetch(`/api/x/posts?handle=${encodeURIComponent(handle)}&mode=${next}`);
        if (!res.ok) return;
        const body = (await res.json()) as PostsResponse;
        setMediaPosts((prev) => ({ ...prev, [next]: body.posts }));
        setTxTimes((prev) => ({ ...prev, ...body.txTimes }));
      } catch {
        /* the tab renders its empty state; reselecting retries */
      } finally {
        setMediaLoading(false);
      }
    },
    [handle, mediaPosts],
  );

  const windowScores = scoresByWindow?.[selectedWindow] ?? scores;
  const loadedUnion = (() => {
    const seen = new Set<string>();
    const union: XPost[] = [];
    for (const p of [...initialPosts, ...streams.hot.extra, ...streams.latest.extra]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        union.push(p);
      }
    }
    return union;
  })();

  const ordered = isMediaMode(mode)
    ? (mediaPosts[mode] ?? [])
    : mode === "best"
      ? eloByPost !== undefined
        ? sortPostsByElo(loadedUnion, eloByPost)
        : sortPostsByScore(loadedUnion, windowScores)
      : streamPosts(mode, streams);

  const showParent = computeShowParent(ordered);
  const threads = buildThreadContext(ordered);
  const tabClass = (active: boolean) =>
    active
      ? "border border-accent px-3 py-1.5 text-foreground"
      : "border border-card-border px-3 py-1.5 text-muted transition-colors hover:border-card-border-hover";

  return (
    <div>
      <div role="tablist" aria-label="Reading order" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
        {pageable && (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "hot"}
            onClick={() => openStreamMode("hot")}
            className={tabClass(mode === "hot")}
          >
            Hot
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={mode === "latest"}
          onClick={() => openStreamMode("latest")}
          className={tabClass(mode === "latest")}
        >
          Latest
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "best"}
          onClick={() => setMode("best")}
          className={tabClass(mode === "best")}
        >
          Best
        </button>
        {pageable && (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "videos"}
              onClick={() => void openMediaMode("videos")}
              className={tabClass(mode === "videos")}
            >
              Videos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "photos"}
              onClick={() => void openMediaMode("photos")}
              className={tabClass(mode === "photos")}
            >
              Photos
            </button>
          </>
        )}
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
                className={tabClass(active)}
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
          {isMediaMode(mode)
            ? mediaLoading
              ? "Finding the media in this archive…"
              : `No ${mode} in this archive.`
            : isStreamMode(mode) && loadingMore
              ? "Loading…"
              : "No posts."}
        </p>
      )}

      {isMediaMode(mode) && ordered.length > 0 && (
        <p className="mt-4 text-center font-mono text-xs text-muted">
          {ordered.length.toLocaleString("en-GB")} {mode === "videos" ? "video" : "photo"} post
          {ordered.length === 1 ? "" : "s"} — the archive&rsquo;s complete set
        </p>
      )}

      {isStreamMode(mode) && pageable && !streams[mode].exhausted && (
        <div ref={sentinelRef} className="py-6 text-center font-mono text-xs text-muted">
          {loadingMore
            ? `Loading more… ${ordered.length.toLocaleString("en-GB")} of ${totalKnown.toLocaleString("en-GB")}`
            : ""}
        </div>
      )}

      {isStreamMode(mode) && pageable && streams[mode].exhausted && ordered.length > initialPosts.length && (
        <p className="mt-4 text-center font-mono text-xs text-muted">
          {ordered.length.toLocaleString("en-GB")} posts loaded
        </p>
      )}
    </div>
  );
}
