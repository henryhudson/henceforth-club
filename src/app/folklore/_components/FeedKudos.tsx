"use client";

import KudosControl, { type KudosCommitResult, type KudosGesture } from "./KudosControl";
import { useKudosSession } from "./kudosSession";

/**
 * The kudos control as it sits on a text row or single-post page. An
 * in-feed kudos is a tip — float debit, public count tick, earned accrual,
 * dealer-priority bump — never a duel and never an Elo write. The server
 * renders this only behind KUDOS_ENABLED; without the flag a row carries no
 * kudos markup at all.
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
