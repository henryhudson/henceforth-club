// The worker loop: the glue that carries a paid text job from a fresh quote to
// a finished on-chain archive, one polling tick at a time. It owns the only
// place custody exists — the per-job keys on this machine's disk — and it is
// the only process that spends the visitor's coin. Runs on the Mac mini only.
//
// A tick processes the states in a fixed order: quoted jobs get a key
// published; awaiting-payment and expiry are handled by the payment watch;
// funded jobs are inscribed and broadcast; inscribed jobs are registered and
// their key deleted. Each job's step is wrapped so one thrown error — an
// advance that rejects, a store that blips — cannot abort the rest of the tick.
//
// The store operations (listJobsInState, advance, getPayload) and every
// network call are injected: the pure orchestration is testable end to end
// with a fake store and a stubbed fetch, and the production runner (the launchd
// job) wires the real Upstash-backed store. The keystore and payment watch are
// real sibling modules imported directly.

import { pathToFileURL } from "node:url";
import { P2PKH } from "@bsv/sdk";
import { createJobKey, deleteJobKey, loadJobKey } from "./keystore.mjs";
import { fetchRawTxHex, fetchTxConfirmed, fetchUnspentOutputs, readUnspentOutputs, refundAddressOf, runWatchTick } from "./payments.mjs";
import { broadcastArchive, buildInscriptionTx, registerHandle } from "./inscribe.mjs";
import { buildSweepTx } from "./sweep.mjs";

// HARD RULE 1 — the premium's destination is Henry's cold revenue address.
// Set 2026-07-15 on Henry's direction ("use the Hudson wallet"): the canonical
// cold wallet, verified on-chain before committing (101.7211 BSV confirmed at
// the time of setting). The worker refuses to start (see revenueAddressError)
// while this is unset or invalid, so no run can ever pay the premium to nowhere.
export const REVENUE_ADDRESS = "1GsP511T8e4VjxYdAGnMYdDd6sWxWybcMP";

// Keep in sync with src/lib/archiveCost.ts DEFAULT_FEE_PER_KB — this .mjs worker
// cannot import the TypeScript module at runtime. The quote priced the archive
// at this same rate, so the visitor's payment covers the inscription's fee.
export const FEE_PER_KB = 100;

// Keep in sync with src/lib/textJob/constants.ts LATE_WATCH_DAYS — the same
// runtime-import constraint. How long after a job's quote expiry the worker
// keeps watching a swept job's custody address for a straggler and, only once
// that window has closed, deletes the retained key (the reaper).
const LATE_WATCH_DAYS = 7;
const LATE_WATCH_MS = LATE_WATCH_DAYS * 24 * 60 * 60 * 1000;

// Warn ONCE per job per process, not every tick. The sweep and late watch flag
// unresolved cases (no refund address, a missing key) for manual intervention;
// without these seen-sets the worker would print the same flag on every poll.
// Module-level so they persist across ticks within the running worker.
const warnedRefundless = new Set();
const warnedMissingKey = new Set();
const warnedLateStraggler = new Set();

function warnOnce(seen, jobId, message) {
  if (seen.has(jobId)) return;
  seen.add(jobId);
  console.warn(message);
}

/**
 * Why the worker refuses to start on a bad revenue address (hard rule 1),
 * or null when the address is a valid one to pay the premium to. Pure — the
 * startup guard and a test can both call it.
 */
export function revenueAddressError(address) {
  if (typeof address !== "string" || address.length === 0) {
    return "REVENUE_ADDRESS is unset — set it to Henry's cold address before starting the worker";
  }
  try {
    new P2PKH().lock(address);
    return null;
  } catch {
    return `REVENUE_ADDRESS is not a valid address: ${address}`;
  }
}

/** Run one job's step, swallowing any throw so a single failure cannot abort
 * the tick. The task-7 review flagged that advance can throw; this is the net. */
async function guarded(label, jobId, step) {
  try {
    await step();
  } catch (err) {
    console.error(`xtext-worker: ${label} for job ${jobId} threw — skipped this tick:`, err);
  }
}

/** quoted -> awaiting-payment: mint a per-job custody key and publish its
 * address. Expiry is the payment watch's job, so an already-expired quote is
 * left for it rather than given a key it would never use. */
async function publishKeys({ listJobsInState, advance, wrapKey, jobsDir, nowMs }) {
  const quoted = await listJobsInState("quoted");
  for (const job of quoted) {
    if (nowMs >= job.expiresAtMs) continue;
    await guarded("key publish", job.jobId, async () => {
      const created = createJobKey(job.jobId, wrapKey, jobsDir);
      if (!created) return; // a refused jobId never happens for server-minted ids
      await advance(job.jobId, { kind: "key-published", address: created.address }, nowMs);
    });
  }
}

/** funded -> inscribed, or -> sweeping on any refusal. The custody key is
 * loaded ONLY inside this step and never cached beyond it; a build refusal
 * (underfunded) or a spent broadcast budget routes to broadcast-failed, which
 * the state machine turns into sweeping. The key is deliberately NOT deleted
 * here — a sweeping job still needs it to refund. */
async function inscribeFunded({ listJobsInState, advance, getPayload, wrapKey, jobsDir, revenueAddress, feeRate, fetchFn, taalApiKey, nowMs }) {
  const funded = await listJobsInState("funded");
  for (const job of funded) {
    await guarded("inscribe", job.jobId, async () => {
      const archiveJson = await getPayload(job.jobId);
      if (!archiveJson) {
        await advance(job.jobId, { kind: "broadcast-failed", reason: "payload-missing" }, nowMs);
        return;
      }

      const jobKey = loadJobKey(job.jobId, wrapKey, jobsDir);
      if (!jobKey) {
        await advance(job.jobId, { kind: "broadcast-failed", reason: "key-missing" }, nowMs);
        return;
      }

      const built = await buildInscriptionTx({
        jobKey,
        funding: { txid: job.fundingTxid, vout: job.fundingVout, sats: job.fundingSats },
        archiveJson,
        premiumSats: job.premiumSats,
        revenueAddress,
        feeRate,
      });
      if (!built.ok) {
        await advance(job.jobId, { kind: "broadcast-failed", reason: built.reason }, nowMs);
        return;
      }

      const broadcast = await broadcastArchive(built.hex, { fetchFn, taalApiKey });
      if (!broadcast.ok) {
        await advance(job.jobId, { kind: "broadcast-failed", reason: broadcast.reason }, nowMs);
        return;
      }

      await advance(job.jobId, { kind: "inscribed", txid: built.txid }, nowMs);
    });
  }
}

/** inscribed -> done: register the archive against its handle. A registration
 * that cannot complete yet (the tx not visible to WhatsOnChain, the index
 * briefly down) is left inscribed to retry next tick; registration is
 * idempotent. The custody key is deliberately NOT deleted at done — a done
 * job's address is late-watched for stragglers exactly as a swept job's is,
 * and only the reaper (in the late watch) deletes the key once the window has
 * closed. Deleting here would strand any second leg on the address forever. */
async function registerInscribed({ listJobsInState, advance, registerBaseUrl, fetchFn, nowMs }) {
  const inscribed = await listJobsInState("inscribed");
  for (const job of inscribed) {
    await guarded("register", job.jobId, async () => {
      const registered = await registerHandle({
        handle: job.handle,
        txid: job.inscriptionTxid,
        baseUrl: registerBaseUrl,
        fetchFn,
      });
      if (!registered.ok) return; // stay inscribed, retry next tick

      await advance(job.jobId, { kind: "registered" }, nowMs);
    });
  }
}

/**
 * sweeping -> swept: return every unspent output on the custody address to the
 * payer. A job reaches sweeping when a broadcast failed or a quote expired with
 * money on the address, and it MUST end with the visitor's coin back home.
 *
 * Two phases per job. If a sweep is already broadcast (sweepTxid recorded), the
 * only work is to wait for its first confirmation, then advance to swept —
 * ignoring stragglers, which the late watch owns after swept. Otherwise the
 * sweep is built and broadcast: the refund address is resolved on chain from
 * the funding transaction's first input (never guessed — an unresolved address
 * keeps the job sweeping, flagged once for ops), the custody key is loaded, and
 * every unspent leg is spent in one transaction to that address. A rejected
 * broadcast simply returns — the money must go home, so this retries next tick
 * indefinitely — and because the build is deterministic the retry replays the
 * same txid. A dust residue that cannot build a broadcastable transaction is
 * resolved directly to swept (nothing sweepable remains); the original failure
 * reason stays on the job and the dust amount is logged for ops.
 *
 * The key is deliberately NOT deleted here — a swept job's address is watched
 * for late payments until LATE_WATCH_MS past expiry, and only the reaper (in
 * the late watch) deletes the key once that window has closed.
 */
async function sweepSweeping({ listJobsInState, advance, wrapKey, jobsDir, fetchFn, taalApiKey, feeRate, nowMs }) {
  const sweeping = await listJobsInState("sweeping");
  for (const job of sweeping) {
    await guarded("sweep", job.jobId, async () => {
      if (job.sweepTxid) {
        if (await fetchTxConfirmed(job.sweepTxid, fetchFn)) {
          await advance(job.jobId, { kind: "sweep-confirmed" }, nowMs);
        }
        return; // an outstanding sweep — wait for its confirmation, don't rebuild
      }

      const utxos = await fetchUnspentOutputs(job.address, fetchFn);
      if (utxos.length === 0) return; // nothing on the address yet — retry next tick

      // The refund goes to the funding transaction's first input. On the
      // broadcast-failed path that address was already resolved and recorded at
      // payment-seen (payerRefundAddress) — recomputing what is known would put
      // a needless network dependency inside the refund path, so the record is
      // preferred. Only a job without one (the expired-underpaid path never
      // recorded a funding) resolves on chain: the recorded funding txid where
      // present, otherwise the actual unspent leg's own source — its real
      // sender, not a guess.
      let refundAddress = job.payerRefundAddress ?? null;
      if (!refundAddress) {
        const refundTxid = job.fundingTxid ?? utxos[0].txid;
        const rawFundingTx = await fetchRawTxHex(refundTxid, fetchFn);
        refundAddress = rawFundingTx ? refundAddressOf(rawFundingTx) : null;
      }
      if (!refundAddress) {
        warnOnce(warnedRefundless, job.jobId, `xtext-worker: sweeping job ${job.jobId} has no resolvable refund address — flagged for ops, will retry`);
        return;
      }

      const jobKey = loadJobKey(job.jobId, wrapKey, jobsDir);
      if (!jobKey) {
        warnOnce(warnedMissingKey, job.jobId, `xtext-worker: sweeping job ${job.jobId} has no custody key on disk — flagged for ops`);
        return;
      }

      const built = await buildSweepTx({ jobKey, fundings: utxos, refundAddress, feeRate });
      if (built.ok === false) {
        const residue = utxos.reduce((sum, u) => sum + u.sats, 0);
        console.warn(`xtext-worker: sweeping job ${job.jobId} residue ${residue} sats is dust — nothing broadcastable, resolving as swept`);
        await advance(job.jobId, { kind: "sweep-confirmed" }, nowMs);
        return;
      }

      const broadcast = await broadcastArchive(built.hex, { fetchFn, taalApiKey });
      if (!broadcast.ok) return; // rejected — retry next tick indefinitely, same deterministic txid

      await advance(job.jobId, { kind: "sweep-broadcast", txid: built.txid }, nowMs);
    });
  }
}

/**
 * swept and done: the late watch and the reaper. Keys outlive both terminal
 * transitions on purpose — a payment can still arrive at the address of a
 * swept job (a duplicate leg) OR a done job (a top-up before funding, a second
 * payment after), and only the retained key can refund it. For LATE_WATCH_MS
 * past the job's quote expiry the address is polled each tick; a straggler is
 * swept straight back to its own sender with the retained key, with no
 * state-machine event (the terminal state is unchanged — idempotency comes from
 * the deterministic rebuild). Once that window closes, the reaper deletes the
 * key, but ONLY after an affirmatively empty read: fetchUnspentOutputs answers
 * [] for both a genuinely empty address and a failed poll, so the reaper reads
 * through readUnspentOutputs and postpones a tick on any failed read rather
 * than deleting a key over funds it merely could not see.
 */
async function lateWatchAndReap({ listJobsInState, wrapKey, jobsDir, fetchFn, taalApiKey, feeRate, nowMs }) {
  const swept = await listJobsInState("swept");
  const done = await listJobsInState("done");
  for (const job of [...swept, ...done]) {
    await guarded("late-watch", job.jobId, async () => {
      if (nowMs - job.expiresAtMs >= LATE_WATCH_MS) {
        const read = await readUnspentOutputs(job.address, fetchFn);
        if (read.ok && read.utxos.length === 0) {
          deleteJobKey(job.jobId, jobsDir); // affirmatively empty and past the window — custody ends here
        }
        return; // a failed read, or funds still present, postpones the reap to a later tick
      }

      const utxos = await fetchUnspentOutputs(job.address, fetchFn);
      if (utxos.length === 0) return; // no straggler — nothing to do this tick

      const rawTx = await fetchRawTxHex(utxos[0].txid, fetchFn);
      const refundAddress = rawTx ? refundAddressOf(rawTx) : null;
      if (!refundAddress) {
        warnOnce(warnedLateStraggler, job.jobId, `xtext-worker: late straggler on terminal job ${job.jobId} has no resolvable refund address — flagged for ops`);
        return;
      }

      const jobKey = loadJobKey(job.jobId, wrapKey, jobsDir);
      if (!jobKey) {
        warnOnce(warnedLateStraggler, job.jobId, `xtext-worker: late straggler on terminal job ${job.jobId} but its key was already reaped — flagged for ops`);
        return;
      }

      const built = await buildSweepTx({ jobKey, fundings: utxos, refundAddress, feeRate });
      if (built.ok === false) {
        // Warn once, not every tick — a dust straggler sits on the address for
        // the rest of the window and there is nothing broadcastable to do with it.
        warnOnce(warnedLateStraggler, job.jobId, `xtext-worker: late straggler on terminal job ${job.jobId} is dust — nothing broadcastable`);
        return;
      }

      const broadcast = await broadcastArchive(built.hex, { fetchFn, taalApiKey });
      if (!broadcast.ok) return; // retry next tick

      console.log(`xtext-worker: late straggler swept for job ${job.jobId} -> ${built.txid}`);
    });
  }
}

/**
 * One worker tick. The phases run in custody order and each is wrapped so a
 * throw in one cannot stop the others. `deps` carries the injected store, the
 * network fetch, the keystore config, the revenue address, and the clock
 * (`nowMs`). The sweep and the late watch close the loop: every failure path
 * ends with the visitor's money back, and keys outlive nothing but an unpaid
 * refund window.
 */
export async function runWorkerTick(deps) {
  await guarded("key-publish phase", "-", () => publishKeys(deps));
  await guarded("payment-watch phase", "-", () =>
    runWatchTick({ listJobsInState: deps.listJobsInState, advance: deps.advance, fetchFn: deps.fetchFn, nowMs: deps.nowMs }),
  );
  await guarded("inscribe phase", "-", () => inscribeFunded(deps));
  await guarded("register phase", "-", () => registerInscribed(deps));
  await guarded("sweep phase", "-", () => sweepSweeping(deps));
  await guarded("late-watch phase", "-", () => lateWatchAndReap(deps));
}

/**
 * The startup gate (hard rule 1): the worker refuses to run while the revenue
 * address is unset or invalid, exiting cleanly with a clear message. The
 * Upstash-backed store, the Keychain wrapping key, and the tick interval are
 * wired by the launchd runner in task 10 — this entry only proves the premium
 * has a real destination before anything can spend a visitor's coin.
 */
export function main() {
  const error = revenueAddressError(REVENUE_ADDRESS);
  if (error) {
    console.error(`xtext-worker refusing to start: ${error}`);
    console.error("Set REVENUE_ADDRESS in scripts/xtext-worker/worker.mjs (a task-10 gate item).");
    process.exit(1);
  }
  console.log("xtext-worker: REVENUE_ADDRESS configured — the launchd runner wires the store and schedules ticks.");
}

// Only when run directly (node worker.mjs), never on import — so a test that
// imports this module never triggers the process exit.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
