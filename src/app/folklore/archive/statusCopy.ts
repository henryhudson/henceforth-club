// Honest, per-state copy for the status poller. Pure — mirrors JobState
// verbatim, and every branch returns rather than guesses: a state this
// function doesn't recognise is a compile error, not a silent blank screen
// (the switch below is exhaustive over every JobState).
//
// "sweeping" and "swept" additionally read failureReason, so a refund's
// cause is never hidden from the visitor whose money it is. "swept" branches
// on sweepTxid, not on failureReason — failureReason only says why a job
// entered sweeping, never whether money actually moved. sweepTxid is written
// once, by the sweep-broadcast transition alone (see jobs.ts); sweep-confirmed
// never sets it. A swept job WITHOUT a sweepTxid never had a refund
// transaction broadcast: either the quote expired before any payment address
// was ever issued (failureReason "expired-before-key"), the quote expired
// unpaid after an address was issued (no failureReason at all), or the
// residue left after a failure was too small to build a broadcastable refund
// — the worker resolves that dust case straight to swept via sweep-confirmed,
// skipping sweep-broadcast entirely (scripts/xtext-worker/worker.mjs,
// sweep.mjs). A swept job WITH a sweepTxid genuinely sent the payment back.

import type { JobState } from "@/lib/folkloreJob/jobs";

export type StatusView = {
  heading: string;
  body: string;
};

export function statusCopy(job: {
  state: JobState;
  handle: string;
  failureReason?: string;
  sweepTxid?: string;
}): StatusView {
  switch (job.state) {
    case "quoted":
      return {
        heading: "Preparing a payment address",
        body: "Your quote is confirmed. A one-time payment address is being generated — this usually takes a few seconds.",
      };
    case "awaiting-payment":
      return {
        heading: "Awaiting payment",
        body: "A one-time payment address has been issued. Nothing is written to Bitcoin until the payment arrives.",
      };
    case "funded":
      return {
        heading: "Payment received",
        body: "Your archive is being written to Bitcoin now.",
      };
    case "inscribed":
      return {
        heading: "On Bitcoin",
        body: "The archive is on chain. Registering it against your handle now.",
      };
    case "done":
      return {
        heading: "Done",
        body: `Your archive is live at /folklore/${job.handle}.`,
      };
    case "sweeping":
      return {
        heading: "Returning your payment",
        body: job.failureReason
          ? `This job could not complete, so your payment is being sent back automatically. Reason: ${job.failureReason}.`
          : "Your payment is being sent back automatically.",
      };
    case "swept":
      if (job.sweepTxid) {
        return {
          heading: "Payment returned",
          body: job.failureReason
            ? `Your payment has been sent back. Reason: ${job.failureReason}.`
            : "Your payment has been sent back.",
        };
      }
      if (job.failureReason === "expired-before-key") {
        return {
          heading: "Quote expired",
          body: "The quote expired before a payment address was ever issued. Nothing was charged.",
        };
      }
      if (job.failureReason) {
        // No sweepTxid means no refund transaction ever broadcast — the dust
        // path (a residue too small to build a broadcastable output) resolves
        // straight to swept without one. Say so honestly rather than quoting
        // a failure reason that implies a refund which never happened.
        return {
          heading: "No refund was possible",
          body: "No refund transaction was made because nothing refundable remained.",
        };
      }
      return {
        heading: "Quote expired",
        body: "The quote expired before payment arrived. Nothing was charged.",
      };
  }
}
