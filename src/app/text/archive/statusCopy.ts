// Honest, per-state copy for the status poller. Pure — mirrors JobState
// verbatim, and every branch returns rather than guesses: a state this
// function doesn't recognise is a compile error, not a silent blank screen
// (the switch below is exhaustive over every JobState).
//
// "sweeping" and "swept" additionally read failureReason, so a refund's
// cause is never hidden from the visitor whose money it is. "swept" carries
// four honest shapes: the quote expired before any address was ever issued
// (failureReason "expired-before-key"), a residue too small to refund
// (failureReason "dust" — no refund transaction was possible, so it must not
// claim one was sent), a payment returned after a real failure (any other
// failureReason), or the quote simply expired unpaid (no failureReason at all
// — nothing was ever charged, so nothing needed returning, but the job still
// crosses this terminal state).

import type { JobState } from "@/lib/textJob/jobs";

export type StatusView = {
  heading: string;
  body: string;
};

export function statusCopy(job: { state: JobState; handle: string; failureReason?: string }): StatusView {
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
        body: `Your archive is live at /text/${job.handle}.`,
      };
    case "sweeping":
      return {
        heading: "Returning your payment",
        body: job.failureReason
          ? `This job could not complete, so your payment is being sent back automatically. Reason: ${job.failureReason}.`
          : "Your payment is being sent back automatically.",
      };
    case "swept":
      if (job.failureReason === "expired-before-key") {
        return {
          heading: "Quote expired",
          body: "The quote expired before a payment address was ever issued. Nothing was charged.",
        };
      }
      if (job.failureReason === "dust") {
        // A dust residue cannot build a broadcastable refund — claiming the
        // payment was "sent back" would be a lie, so this branch says the
        // honest thing instead.
        return {
          heading: "No refund was possible",
          body: "The remaining amount was below the miner fee, so no refund transaction was possible.",
        };
      }
      if (job.failureReason) {
        return {
          heading: "Payment returned",
          body: `Your payment has been sent back. Reason: ${job.failureReason}.`,
        };
      }
      return {
        heading: "Quote expired",
        body: "The quote expired before payment arrived. Nothing was charged.",
      };
  }
}
