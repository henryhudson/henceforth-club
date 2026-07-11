"use client";

import { useState } from "react";
import { DEFAULT_WINDOW, type ScoreWindow } from "@/lib/xScore";
import type { XPost } from "../parseArchive";
import type { ThreadContext } from "./threadContext";
import { sortPostsByScore } from "../sortPosts";
import PostEntry from "./PostEntry";

const WINDOWS: ReadonlyArray<{ value: ScoreWindow; label: string }> = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

/**
 * The ranking window for the feed — Today / This week / This month / This
 * year / All time, defaulting to `week` (`DEFAULT_WINDOW`) so the first
 * client paint matches what the server already rendered. Owns the ordering
 * (the pure `sortPostsByScore` fold) and renders each row through the same
 * `PostEntry` the plain feed uses, so the row itself is never redrawn twice —
 * only reused. `showParent`/`threads` stay index-aligned to `posts`' given
 * (unsorted) order — the same shape `ProfileView` already computes — and are
 * looked up here by post id once the fold puts posts in a different order.
 * A function prop can't cross the server/client boundary, which is why this
 * takes plain data (posts + parallel arrays) rather than a render callback.
 */
export default function WindowToggle({
  posts,
  showParent,
  threads,
  txTimes,
  handle,
  scoresByWindow,
}: {
  posts: readonly XPost[];
  showParent: readonly boolean[];
  threads: readonly (ThreadContext | undefined)[];
  txTimes: Record<string, number>;
  handle?: string;
  scoresByWindow: Record<ScoreWindow, Record<string, number>>;
}) {
  const [selected, setSelected] = useState<ScoreWindow>(DEFAULT_WINDOW);
  const scores = scoresByWindow[selected];
  const ordered = sortPostsByScore(posts, scores);
  const showParentById = new Map(posts.map((p, i) => [p.id, showParent[i]]));
  const threadById = new Map(posts.map((p, i) => [p.id, threads[i]]));

  return (
    <div>
      <div role="group" aria-label="Ranking window" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
        {WINDOWS.map(({ value, label }) => {
          const active = value === selected;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(value)}
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
      <div className="divide-y divide-card-border border-t border-card-border">
        {ordered.map((post) => (
          <PostEntry
            key={post.id}
            post={post}
            showParent={showParentById.get(post.id) ?? false}
            txTime={post.txid ? txTimes[post.txid] : undefined}
            thread={threadById.get(post.id)}
            handle={handle}
            sats={scores[post.id]}
          />
        ))}
      </div>
    </div>
  );
}
