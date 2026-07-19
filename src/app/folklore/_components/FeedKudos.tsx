"use client";

import KudosControl, { type KudosCommitResult, type KudosGesture } from "./KudosControl";
import { useKudosSession } from "./kudosSession";

/**
 * The in-feed like — kudos as a tip. Float debit, public count, earned
 * accrual, dealer-priority bump; never a duel and never an Elo write.
 * Always on the row when a handle is known so the gesture is visible.
 */
export default function FeedKudos({
  handle,
  postId,
  count,
}: {
  handle: string;
  postId: string;
  count?: number;
}) {
  const session = useKudosSession();
  const gesture: KudosGesture =
    session === null || session.kind === "unavailable"
      ? { kind: "quiet" }
      : session.kind === "visitor"
        ? { kind: "visitor" }
        : { kind: "ready" };

  const commitTip = async (amount: number): Promise<KudosCommitResult> => {
    try {
      const res = await fetch("/api/folklore/tip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, postId, amount }),
      });
      return res.ok ? { kind: "recorded" } : { kind: "refused" };
    } catch {
      return { kind: "refused" };
    }
  };

  return (
    <KudosControl
      gesture={gesture}
      count={count}
      label={`give kudos to this text by @${handle}`}
      onCommit={commitTip}
    />
  );
}
