"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import KudosControl, { KUDOS_NUDGE, type KudosCommitResult } from "../_components/KudosControl";
import { fetchKudosSession } from "../_components/kudosSession";

// The arena — a dealt stacked pair with NO vote buttons: each text carries
// the same kudos control as every feed row, and the kudos gesture itself
// crowns the duel. The first kudos crowns the pair (binary, whatever the
// amount lands at); rapid further taps accumulate to the winner through the
// commit beat; the resolution's response deals the next pair. Pairs are
// server-dealt and single-use — this component never chooses a matchup.

/** One dealt side, as the duel route hydrates it. */
export type WireSide = { postId: string; author: string; text: string };

/** A dealt pair on the wire: the single-use token and the two sides, in
 * stack order. */
export type WireDeal = { token: string; pair: [WireSide, WireSide] };

export type ArenaPhase =
  | { kind: "loading" }
  | { kind: "visitor" }
  | { kind: "unavailable" }
  | { kind: "empty" }
  | { kind: "live"; deal: WireDeal; crownedPostId: string | null };

type DealFetch =
  | { kind: "dealt"; deal: WireDeal }
  | { kind: "empty" }
  | { kind: "unavailable" };

async function fetchDeal(): Promise<DealFetch> {
  try {
    const res = await fetch("/api/folklore/duel");
    if (!res.ok) return { kind: "unavailable" };
    const body = (await res.json()) as { deal?: WireDeal | null };
    return body.deal ? { kind: "dealt", deal: body.deal } : { kind: "empty" };
  } catch {
    return { kind: "unavailable" };
  }
}

export default function Arena() {
  const [phase, setPhase] = useState<ArenaPhase>({ kind: "loading" });
  const [float, setFloat] = useState<number | null>(null);
  // Commits serialize through one queue: the crowning resolution must reach
  // the server before any follow-up beat that shares its token.
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let live = true;
    void (async () => {
      const session = await fetchKudosSession();
      if (!live) return;
      if (session.kind === "visitor") {
        setPhase({ kind: "visitor" });
        return;
      }
      if (session.kind === "unavailable") {
        setPhase({ kind: "unavailable" });
        return;
      }
      setFloat(session.float);
      const dealt = await fetchDeal();
      if (!live) return;
      setPhase(
        dealt.kind === "dealt"
          ? { kind: "live", deal: dealt.deal, crownedPostId: null }
          : { kind: dealt.kind },
      );
    })();
    return () => {
      live = false;
    };
  }, []);

  // Every tap is one kudos leaving the float, shown before the server
  // confirms; the first tap of a pair crowns its side. The balance is
  // server-authoritative — each commit's response overwrites the guess.
  const handleTap = (side: WireSide) => {
    setFloat((f) => (f === null ? f : f - 1));
    setPhase((p) =>
      p.kind === "live" && p.crownedPostId === null ? { ...p, crownedPostId: side.postId } : p,
    );
  };

  const commitFor =
    (deal: WireDeal, side: WireSide) =>
    (amount: number): Promise<KudosCommitResult> => {
      const run = queue.current.then(async (): Promise<KudosCommitResult> => {
        try {
          const res = await fetch("/api/folklore/duel", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: deal.token, winnerPostId: side.postId, amount }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            kind?: string;
            float?: number;
            next?: WireDeal | null;
          };
          if (typeof body.float === "number") setFloat(body.float);
          if (!res.ok) {
            // The token burned without a duel (float short, pair expired) —
            // this pair cannot resolve any more, so deal afresh.
            const dealt = await fetchDeal();
            setPhase(
              dealt.kind === "dealt"
                ? { kind: "live", deal: dealt.deal, crownedPostId: null }
                : { kind: dealt.kind },
            );
            return { kind: "refused" };
          }
          if (body.kind === "duel") {
            setPhase(body.next ? { kind: "live", deal: body.next, crownedPostId: null } : { kind: "empty" });
          }
          // A "tip" answer is a follow-up beat that landed after the
          // resolution — the float is updated, the pair already swapped.
          return { kind: "recorded" };
        } catch {
          return { kind: "refused" };
        }
      });
      queue.current = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    };

  return <ArenaView phase={phase} float={float} onTap={handleTap} commitFor={commitFor} />;
}

const recordedCommit = () => async (): Promise<KudosCommitResult> => ({ kind: "recorded" });

/**
 * The arena's markup, pure of fetching — the stacked pair, the shared kudos
 * control on each text, the crowned state, and the float sitting quietly in
 * a corner. Exported on its own so the snapshot tests render each phase
 * without a network.
 */
export function ArenaView({
  phase,
  float,
  onTap = () => {},
  commitFor = recordedCommit,
}: {
  phase: ArenaPhase;
  float: number | null;
  onTap?: (side: WireSide) => void;
  commitFor?: (deal: WireDeal, side: WireSide) => (amount: number) => Promise<KudosCommitResult>;
}) {
  return (
    <div className="mx-auto max-w-[68ch] px-6 py-10">
      <p className="ledger-label mb-1">the arena · two texts, dealt</p>
      <p className="mb-6 text-xs text-muted">
        Give kudos to the one you prefer — the first kudos crowns it, and every further tap in
        the beat goes to the winner.
      </p>

      {phase.kind === "loading" && <p className="font-mono text-sm text-muted">dealing…</p>}

      {phase.kind === "visitor" && (
        <div className="rounded-lg border border-card-border bg-card-bg px-5 py-6">
          <p className="text-sm text-foreground">
            The arena runs on kudos, and kudos come with an archive.
          </p>
          <p className="mt-2 text-sm text-muted">{KUDOS_NUDGE}</p>
          <Link
            href="/folklore"
            className="mt-4 inline-block font-mono text-sm text-accent hover:underline"
          >
            open your archive &rarr;
          </Link>
        </div>
      )}

      {phase.kind === "empty" && (
        <p className="text-sm text-muted">
          The pool cannot put up two texts yet — more archives are on their way.
        </p>
      )}

      {phase.kind === "unavailable" && (
        <p className="text-sm text-muted">The arena is resting. Try again in a moment.</p>
      )}

      {phase.kind === "live" && (
        <div className="space-y-4">
          {phase.deal.pair.map((side) => {
            const crowned = phase.crownedPostId === side.postId;
            const open = phase.crownedPostId === null;
            return (
              <article
                key={`${phase.deal.token}:${side.postId}`}
                className={
                  crowned
                    ? "rounded-lg border border-accent bg-card-bg px-5 py-5"
                    : open
                      ? "rounded-lg border border-card-border bg-card-bg px-5 py-5"
                      : "rounded-lg border border-card-border bg-card-bg px-5 py-5 opacity-60"
                }
              >
                <p className="mb-2 text-xs text-muted">
                  <Link href={`/folklore/${side.author}`} className="hover:text-accent">
                    @{side.author}
                  </Link>
                  {crowned && <span className="ml-2 font-mono text-accent">crowned</span>}
                </p>
                <p className="whitespace-pre-wrap text-base leading-loose text-foreground">
                  {side.text}
                </p>
                <div className="mt-3">
                  <KudosControl
                    gesture={open || crowned ? { kind: "ready" } : { kind: "quiet" }}
                    label={`give kudos to @${side.author}`}
                    onTap={() => onTap(side)}
                    onCommit={commitFor(phase.deal, side)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {float !== null && (
        <p
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 right-4 z-40 font-mono text-[11px] text-muted"
        >
          float <span className="text-accent">{float.toLocaleString("en-GB")}</span>
        </p>
      )}
    </div>
  );
}
