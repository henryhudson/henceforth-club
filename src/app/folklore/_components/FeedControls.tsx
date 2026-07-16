"use client";

import { useState, type ReactNode } from "react";
import { DEFAULT_WINDOW, type ScoreWindow } from "@/lib/xScore";
import type { XPost } from "../parseArchive";
import type { ThreadContext } from "./threadContext";
import { sortPostsByScore } from "../sortPosts";
import PostEntry from "./PostEntry";

type Mode = "latest" | "best";

const WINDOWS: ReadonlyArray<{ value: ScoreWindow; label: string }> = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

/**
 * The feed's one ranking control: a Latest/Best tab strip, and — under Best
 * only — the Today/This week/This month/This year/All time window buttons.
 * Defaults to Best + `week` (`DEFAULT_WINDOW`) so the first client paint
 * matches what the server already rendered. Latest shows `posts` in the
 * order they already arrived in (no re-sort — that order IS chronological);
 * Best folds them through the pure `sortPostsByScore`. Either mode renders
 * each row through the same `PostEntry` the plain feed used to call
 * directly, so the row markup is never duplicated.
 *
 * `scoresByWindow` is the full per-window table (only the live witness feed
 * computes it); `scores` is the single flat table other callers pass. Best
 * mode ranks by `scoresByWindow[selectedWindow]` when present, else falls back
 * to `scores`. The window buttons only render when `scoresByWindow` is present
 * — a caller with a single score table gets a working Best tab but NOT five
 * buttons that would all show the same order (a no-op that misleads).
 *
 * `showParent`/`threads` stay index-aligned to `posts`' given (unsorted)
 * order — the same shape `ProfileView` already computes — and are looked up
 * here by post id once Best puts posts in a different order. A function
 * prop can't cross the server/client boundary, which is why this takes
 * plain data (posts + parallel arrays) rather than a render callback.
 */
export default function FeedControls({
  posts,
  showParent,
  threads,
  txTimes,
  handle,
  scores = {},
  scoresByWindow,
  footer,
}: {
  posts: readonly XPost[];
  showParent: readonly boolean[];
  threads: readonly (ThreadContext | undefined)[];
  txTimes: Record<string, number>;
  handle?: string;
  scores?: Record<string, number>;
  scoresByWindow?: Record<ScoreWindow, Record<string, number>>;
  /** The scroll loader, when the caller has one. Rendered ONLY in Latest
   * mode: the loader always appends chronological pages, so under Best it
   * quietly degraded the ranking at post 31 — sat-ranked rows, then an
   * unmarked chronological tail the mode toggles never re-ordered. Best now
   * says honestly that it ranks the loaded page. */
  footer?: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("best");
  const [selectedWindow, setSelectedWindow] = useState<ScoreWindow>(DEFAULT_WINDOW);
  const windowScores = scoresByWindow?.[selectedWindow] ?? scores;
  const ordered = mode === "best" ? sortPostsByScore(posts, windowScores) : posts;
  const showParentById = new Map(posts.map((p, i) => [p.id, showParent[i]]));
  const threadById = new Map(posts.map((p, i) => [p.id, threads[i]]));

  return (
    <div>
      <div role="tablist" aria-label="Reading order" className="mb-4 flex gap-2 font-mono text-xs">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "latest"}
          onClick={() => setMode("latest")}
          className={
            mode === "latest"
              ? "rounded-md border border-accent px-3 py-1.5 text-foreground"
              : "rounded-md border border-card-border px-3 py-1.5 text-muted transition-colors hover:border-card-border-hover"
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
              ? "rounded-md border border-accent px-3 py-1.5 text-foreground"
              : "rounded-md border border-card-border px-3 py-1.5 text-muted transition-colors hover:border-card-border-hover"
          }
        >
          Best
        </button>
      </div>
      {mode === "best" && scoresByWindow && (
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
                    ? "rounded-md border border-accent px-3 py-1.5 text-foreground"
                    : "rounded-md border border-card-border px-3 py-1.5 text-muted transition-colors hover:border-card-border-hover"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      <div className="divide-y divide-card-border border-t border-card-border">
        {ordered.map((post) => (
          <PostEntry
            key={post.id}
            post={post}
            showParent={showParentById.get(post.id) ?? false}
            txTime={post.txid ? txTimes[post.txid] : undefined}
            thread={threadById.get(post.id)}
            handle={handle}
            sats={windowScores[post.id]}
          />
        ))}
      </div>
      {footer !== undefined &&
        (mode === "latest" ? (
          footer
        ) : (
          <p className="mt-4 text-center font-mono text-xs text-muted">
            Best ranks the {posts.length} loaded posts — switch to Latest to read the whole archive.
          </p>
        ))}
    </div>
  );
}
