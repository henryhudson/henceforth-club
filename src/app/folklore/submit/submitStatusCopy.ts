// Per-state copy for the submit flow's status poller. The refund states
// (sweeping, swept) and the pre-payment states (quoted, awaiting-payment)
// delegate to the archive's statusCopy verbatim — their wording is already
// kind-neutral, and the sweepTxid-versus-failureReason honesty rules
// documented there must live in exactly one place. Only the states whose
// archive wording names an archive are re-said for a link or a comment.

import type { JobState } from "@/lib/folkloreJob/jobs";
import { statusCopy, type StatusView } from "../archive/statusCopy";

export function submitStatusCopy(job: {
  state: JobState;
  kind: "link" | "comment";
  failureReason?: string;
  sweepTxid?: string;
}): StatusView {
  switch (job.state) {
    case "funded":
      return {
        heading: "Payment received",
        body: `Your ${job.kind} is being written to Bitcoin now.`,
      };
    case "inscribed":
      return {
        heading: "On Bitcoin",
        body: `The ${job.kind} is on chain. Adding it to the board now.`,
      };
    case "done":
      return {
        heading: "On the board",
        body:
          job.kind === "link"
            ? "Your link is live on the folklore board."
            : "Your comment is live under its link.",
      };
    default:
      return statusCopy({
        state: job.state,
        handle: "",
        failureReason: job.failureReason,
        sweepTxid: job.sweepTxid,
      });
  }
}
