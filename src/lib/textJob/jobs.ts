// The paid text-job pipeline's state machine. Pure — no network, no clock,
// no randomness; time and every fact about the world (a payment seen, a
// broadcast confirmed) arrive as event data, never read from inside here.
//
// applyEvent is total: every (state, event) pair returns an outcome, never
// throws. Most pairs outside the transition table below are simply not
// valid moves and are refused — that refusal is itself the well-defined
// answer, not a missing case.

export type JobState =
  | "quoted"
  | "awaiting-payment"
  | "funded"
  | "inscribed"
  | "done"
  | "sweeping"
  | "swept";

export type TextJob = {
  jobId: string;
  handle: string;
  contentHash: string;
  feeSats: number;
  premiumSats: number;
  priceSats: number;
  state: JobState;
  createdAtMs: number;
  expiresAtMs: number;
  address?: string; // written once, by the worker only
  fundingTxid?: string;
  fundingVout?: number;
  fundingSats?: number;
  payerRefundAddress?: string;
  inscriptionTxid?: string;
  sweepTxid?: string;
  failureReason?: string;
};

export type JobEvent =
  | { kind: "key-published"; address: string }
  | { kind: "payment-seen"; txid: string; vout: number; sats: number; refundAddress: string }
  | { kind: "expired"; residueSats: number }
  | { kind: "inscribed"; txid: string }
  | { kind: "registered" }
  | { kind: "broadcast-failed"; reason: string }
  | { kind: "sweep-broadcast"; txid: string }
  | { kind: "sweep-confirmed" };

type Result = { ok: true; job: TextJob } | { ok: false; refused: string };

const ok = (job: TextJob): Result => ({ ok: true, job });
const refuse = (reason: string): Result => ({ ok: false, refused: reason });

/**
 * Total: every (state, event) pair returns a job or a refusal — never throws.
 * `nowMs` is part of the contract every event-applying function in this
 * pipeline shares (see jobStore's createJob); no transition below happens to
 * need it, since the watcher already decides "expired" by comparing the
 * clock to expiresAtMs before it ever emits the event.
 */
export function applyEvent(job: TextJob, event: JobEvent, nowMs: number): Result {
  void nowMs;

  switch (job.state) {
    case "quoted":
      switch (event.kind) {
        case "key-published":
          return ok({ ...job, state: "awaiting-payment", address: event.address });
        case "expired":
          // Liveness: without this exit, a job abandoned before the worker
          // publishes a key (worker crash, store outage) would occupy one of
          // the concurrent-capacity slots forever — four stuck quoted jobs
          // would wedge the whole pipeline at capacity. A quoted job has no
          // published address, so nonzero residue should be impossible; the
          // machine stays total and defensive, routing by residue exactly
          // as awaiting-payment does.
          return event.residueSats > 0
            ? ok({ ...job, state: "sweeping" })
            : ok({ ...job, state: "swept", failureReason: "expired-before-key" });
        default:
          return refuse("invalid-transition");
      }

    case "awaiting-payment":
      switch (event.kind) {
        case "key-published":
          // Crash-resume replay: the worker may re-publish the same key it
          // already recorded. Same address is a no-op; a different one is
          // a bug, never silently accepted.
          return event.address === job.address ? ok(job) : refuse("address-mismatch");
        case "payment-seen":
          // Underpayment is not this function's concern — the watcher only
          // emits payment-seen at or above the quoted price; a below-quote
          // balance rides the expired branch instead.
          return ok({
            ...job,
            state: "funded",
            fundingTxid: event.txid,
            fundingVout: event.vout,
            fundingSats: event.sats,
            payerRefundAddress: event.refundAddress,
          });
        case "expired":
          return event.residueSats > 0
            ? ok({ ...job, state: "sweeping" })
            : ok({ ...job, state: "swept" });
        default:
          return refuse("invalid-transition");
      }

    case "funded":
      switch (event.kind) {
        case "inscribed":
          return ok({ ...job, state: "inscribed", inscriptionTxid: event.txid });
        case "broadcast-failed":
          return ok({ ...job, state: "sweeping", failureReason: event.reason });
        default:
          return refuse("invalid-transition");
      }

    case "inscribed":
      switch (event.kind) {
        case "registered":
          return ok({ ...job, state: "done" });
        case "inscribed":
          // Crash-resume replay of the same broadcast.
          return event.txid === job.inscriptionTxid ? ok(job) : refuse("txid-mismatch");
        default:
          return refuse("invalid-transition");
      }

    case "sweeping":
      switch (event.kind) {
        case "sweep-broadcast":
          // First broadcast records the txid; a replay with the same txid
          // is a no-op, a different one is a conflicting broadcast.
          if (job.sweepTxid !== undefined && job.sweepTxid !== event.txid) {
            return refuse("txid-mismatch");
          }
          return ok({ ...job, sweepTxid: event.txid });
        case "sweep-confirmed":
          return ok({ ...job, state: "swept" });
        default:
          return refuse("invalid-transition");
      }

    case "done":
    case "swept":
      // Terminal: nothing more happens to a finished job, not even a replay
      // of the event that finished it.
      return refuse(`job-already-${job.state}`);

    default: {
      const exhaustive: never = job.state;
      return refuse(`unreachable-state-${exhaustive}`);
    }
  }
}
