"use client";

import { useEffect, useRef, useState } from "react";
import { commitDue, restingBeat, tap, type Beat } from "./kudosBeat";

/** How long the beat stays open after a tap before the batched amount
 * commits — short enough to feel immediate, long enough to catch a burst. */
export const KUDOS_BEAT_MS = 900;

/** The one-line nudge a visitor without a float sees — the £2 funnel. */
export const KUDOS_NUDGE = "Open your archive to get kudos — the £2 becomes your float.";

/** What the control may do right now. */
export type KudosGesture =
  | { kind: "ready" }
  | { kind: "visitor" } // no float behind the session — disabled, nudged
  | { kind: "quiet" }; // session still unknown, or the side cannot take kudos — disabled, no pitch

/** How a committed amount landed. `refused` rolls the optimistic taps back —
 * the applause never became money. */
export type KudosCommitResult = { kind: "recorded" } | { kind: "refused" };

/**
 * The one kudos control, everywhere — text rows, single-post pages, and both
 * sides of the arena's dealt pair. A tap is one kudos; rapid taps batch
 * through the commit beat (a pure fold in kudosBeat.ts — this component owns
 * only the timer and the fetch hand-off) and commit as a single amount. The
 * count shown is the public tally plus what this visitor has optimistically
 * given; a refused commit takes its taps back.
 */
export default function KudosControl({
  gesture,
  count,
  label = "give kudos",
  onTap,
  onCommit,
  beatMs = KUDOS_BEAT_MS,
}: {
  gesture: KudosGesture;
  /** The public tally under the control, when the surface shows one. */
  count?: number;
  /** Accessible name — say whose text the kudos reach. */
  label?: string;
  /** Fired on every tap, before the beat commits — the arena crowns the
   * pair on the first of these. */
  onTap?: () => void;
  onCommit: (amount: number) => Promise<KudosCommitResult>;
  beatMs?: number;
}) {
  // The beat lives in a ref so the timer callback folds the latest state;
  // the numbers the markup shows mirror it as state. The commit callback
  // rides in a ref too, so the unmount flush never holds a stale one.
  const beatRef = useRef<Beat>(restingBeat);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);
  const [pending, setPending] = useState(0);
  const [given, setGiven] = useState(0);

  const commit = async (amount: number) => {
    if ((await onCommitRef.current(amount)).kind === "refused") {
      setGiven((g) => g - amount);
    }
  };

  const close = () => {
    const due = commitDue(beatRef.current, Date.now());
    beatRef.current = due.beat;
    setPending(due.beat.pending);
    if (due.commit > 0) void commit(due.commit);
  };

  const handleTap = () => {
    beatRef.current = tap(beatRef.current, Date.now(), beatMs);
    setPending(beatRef.current.pending);
    setGiven((g) => g + 1);
    onTap?.();
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(close, beatMs);
  };

  // Leaving the surface mid-beat commits what is pending — a tap is a
  // promise of money, and unmounting must not quietly break it.
  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      const parting = beatRef.current;
      beatRef.current = restingBeat;
      if (parting.pending > 0) void onCommitRef.current(parting.pending);
    };
  }, []);

  const shown = (count ?? 0) + given;
  return (
    <button
      type="button"
      disabled={gesture.kind !== "ready"}
      aria-label={label}
      title={gesture.kind === "visitor" ? KUDOS_NUDGE : undefined}
      onClick={handleTap}
      className="font-mono text-xs text-muted transition-colors enabled:hover:text-accent enabled:active:scale-95 disabled:opacity-60"
    >
      ✦ kudos
      {shown > 0 && <span className="text-accent"> · {shown.toLocaleString("en-GB")}</span>}
      {pending > 0 && (
        <span aria-hidden className="text-accent">
          {" "}
          +{pending}
        </span>
      )}
    </button>
  );
}
