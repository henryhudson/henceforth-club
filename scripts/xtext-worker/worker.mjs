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
// Since the folklore link board, a job whose payload is a folklore record
// (deps.folklore classifies it) rides the same rails end to end, but its
// OP_RETURN is A1's encodeRecord bytes and its completion is a board index
// write instead of handle registration.
//
// The store operations (listJobsInState, advance, getPayload) and every
// network call are injected: the pure orchestration is testable end to end
// with a fake store and a stubbed fetch, and the production runner (the launchd
// job) wires the real Upstash-backed store. The keystore and payment watch are
// real sibling modules imported directly.

import { pathToFileURL } from "node:url";
import { P2PKH } from "@bsv/sdk";
import { clearLateSweep, createJobKey, deleteJobKey, loadJobKey, loadJobKeyDetailed, readLateSweep, recordLateSweep } from "./keystore.mjs";
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

// Keep in sync with src/lib/folkloreJob/constants.ts LATE_WATCH_DAYS — the same
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
const warnedFolklorePayload = new Set();
const warnedEndowedUnwired = new Set();

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

/**
 * Why a job's £2 kudos float leg cannot be paid: the float pool address
 * (XTEXT_FLOAT_POOL_ADDRESS in the runner's environment) is unset or not a
 * valid address. Unlike the revenue address this is NOT a startup gate — a
 * worker with no pool configured runs fine until a float-leg job arrives,
 * and then that one job refuses per tick and refunds, never paying the leg
 * to nowhere. Pure, callable by the guard, the runner, and tests alike.
 */
export function floatPoolAddressError(address) {
  if (typeof address !== "string" || address.length === 0) {
    return "the float pool address is unset — set XTEXT_FLOAT_POOL_ADDRESS before kudos-float jobs can inscribe";
  }
  try {
    new P2PKH().lock(address);
    return null;
  } catch {
    return `the float pool address is not a valid address: ${address}`;
  }
}

/**
 * The £2 leg derived from the untouched record schema: price minus fee minus
 * premium. Exactly zero for a £1-era record (fee plus premium was the whole
 * price, and older records never stored feeSats at all), exactly the float
 * leg for a £2-era one; anything corrupt reads as no leg rather than a
 * negative or NaN output amount.
 */
export function floatLegSats(job) {
  const { feeSats, premiumSats, priceSats } = job;
  if (![feeSats, premiumSats, priceSats].every(Number.isSafeInteger)) return 0;
  const leg = priceSats - feeSats - premiumSats;
  return leg > 0 ? leg : 0;
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

/**
 * A folklore link or comment job's payload carries the record's own app tag
 * (the route stores the validated record verbatim); an archive payload never
 * does. This one-field sniff only routes — full classification is
 * deps.folklore.recordFromValue, A1's own validators injected by the runner,
 * so the worker never grows a second shape check.
 */
function isFolkloreTagged(payload) {
  return typeof payload === "object" && payload !== null && payload.app === "folklore";
}

/**
 * What a job IS, read from the job record rather than from its payload.
 *
 * The payload is not a durable classifier: jobStore deletes it at done and
 * swept, and any read can answer null. Sniffing it meant a null payload was
 * "not folklore" — so a folklore job whose payload had gone fell through to
 * handle registration carrying the empty handle every link job has, was
 * refused, and retried forever in the ACTIVE `inscribed` state, holding one
 * of the four custody slots for good. `kind` is written once at creation and
 * outlives the payload.
 *
 * The sniff survives only as the fallback for a job stored before the field
 * existed, and can go once none can remain.
 */
function isFolkloreJob(job, payload) {
  if (job.kind === "folklore") return true;
  if (job.kind === "archive") return false;
  return isFolkloreTagged(payload);
}

/** quoted -> awaiting-payment: mint a per-job custody key and publish its
 * address. Expiry is the payment watch's job, so an already-expired quote is
 * left for it rather than given a key it would never use. */
async function publishKeys({ listJobsInState, advance, wrapKey, jobsDir, nowMs }) {
  const quoted = await listJobsInState("quoted");
  for (const job of quoted) {
    // An endowed (pass-redeemed) job is priced at zero: no payment UTXO will
    // ever arrive, so inscribing it needs the standing hot-float wallet that
    // does not exist yet — a new custody surface the card requires its own
    // money-path adversarial review for. Until that leg is built and
    // reviewed, refuse here, before an address is ever published: the job
    // expires unfunded via the payment watch's quoted-expiry sweep, nothing
    // is inscribed, and no visitor is ever shown an address for a free job.
    if (job.endowed) {
      warnOnce(warnedEndowedUnwired, job.jobId, `xtext-worker: endowed job ${job.jobId} refused — float-funded inscription is not built yet; the job will expire unfunded`);
      continue;
    }
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
async function inscribeFunded({ listJobsInState, advance, getPayload, wrapKey, jobsDir, revenueAddress, floatPoolAddress, feeRate, fetchFn, taalApiKey, folklore, nowMs }) {
  const funded = await listJobsInState("funded");
  for (const job of funded) {
    await guarded("inscribe", job.jobId, async () => {
      const payload = await getPayload(job.jobId);
      if (!payload) {
        await advance(job.jobId, { kind: "broadcast-failed", reason: "payload-missing" }, nowMs);
        return;
      }

      // A folklore job's OP_RETURN is A1's encodeRecord bytes, re-validated
      // here at the spend moment: a payload that no longer validates (or a
      // worker missing the folklore wiring) refuses BEFORE anything is signed
      // or broadcast, and the visitor's money routes home through the sweep.
      let archiveJson = payload;
      if (isFolkloreJob(job, payload)) {
        const record = folklore ? folklore.recordFromValue(payload) : null;
        if (!record) {
          await advance(
            job.jobId,
            { kind: "broadcast-failed", reason: folklore ? "record-invalid" : "folklore-unwired" },
            nowMs,
          );
          return;
        }
        archiveJson = new TextDecoder().decode(folklore.encodeRecord(record));
      }

      // The £2 leg needs a destination before anything is signed or spent: a
      // float-leg job on a worker with no valid pool address refuses here and
      // routes to the refund path — the visitor's money goes home rather than
      // the float leg going nowhere.
      const floatSats = floatLegSats(job);
      if (floatSats > 0 && floatPoolAddressError(floatPoolAddress)) {
        await advance(job.jobId, { kind: "broadcast-failed", reason: "float-pool-unconfigured" }, nowMs);
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
        floatSats,
        floatPoolAddress,
        payerRefundAddress: job.payerRefundAddress ?? null,
        feeRate,
      });
      if (!built.ok) {
        await advance(job.jobId, { kind: "broadcast-failed", reason: built.reason }, nowMs);
        return;
      }

      const broadcast = await broadcastArchive(built.hex, { fetchFn, taalApiKey });
      if (!broadcast.ok) {
        // A refusal can be a lie: a response lost after acceptance (a gateway
        // timeout, a dropped connection) reports failure for a transaction
        // the network took. Believing it would route the job into a sweep
        // with nothing left to sweep — wedged forever while the visitor's
        // archive sits on chain unregistered. Probe by txid before believing;
        // and when the probe also misses, record the attempted txid so the
        // sweep phase can discover a late-propagating truth and self-heal.
        const seenHex = await fetchRawTxHex(built.txid, fetchFn);
        if (seenHex) {
          await advance(job.jobId, { kind: "inscribed", txid: built.txid }, nowMs);
          return;
        }
        await advance(
          job.jobId,
          { kind: "broadcast-failed", reason: broadcast.reason, attemptedTxid: built.txid },
          nowMs,
        );
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
async function registerInscribed({ listJobsInState, advance, getPayload, registerBaseUrl, fetchFn, folklore, nowMs }) {
  const inscribed = await listJobsInState("inscribed");
  for (const job of inscribed) {
    await guarded("register", job.jobId, async () => {
      // A pass purchase completes at inscription: the endowment record is on
      // chain, and the pass itself is recorded site-side at the poll edge
      // (src/lib/folkloreJob/pass.ts). There is no handle registration and no
      // board index write to do — routing it into either would refuse forever
      // and hold a custody slot for good.
      if (job.kind === "pass") {
        await advance(job.jobId, { kind: "registered" }, nowMs);
        return;
      }

      // A folklore job completes by feeding the board index, not the handle
      // registry — and it knows which it is from its own `kind`, so a payload
      // that has gone missing can no longer misroute it into registration.
      const payload = await getPayload(job.jobId);
      if (isFolkloreJob(job, payload)) {
        // Where a null actually lands: an absent payload cannot be validated,
        // so it is flagged and retried rather than sniffed as "not folklore".
        const record = payload && folklore ? folklore.recordFromValue(payload) : null;
        if (!record) {
          // Can't-happen in a wired worker (the inscribe phase validated the
          // same payload one state earlier) — flagged, never advanced blind.
          warnOnce(warnedFolklorePayload, job.jobId, `xtext-worker: inscribed folklore job ${job.jobId} has no usable record payload — flagged for ops, will retry`);
          return;
        }

        // The chain is truth and already carries the record; the index write
        // must eventually follow it. Index first, advance second: a write
        // that fails — or an advance that fails after it — replays next tick,
        // and every writer in folkloreBoard is idempotent, so the replay is
        // harmless. A miss is loud, never silently dropped.
        const indexed =
          record.kind === "comment"
            ? await folklore.addCommentToIndex(record.parent, job.inscriptionTxid, nowMs)
            : await folklore.addLinkToBoard(job.inscriptionTxid, record, nowMs);
        if (!indexed) {
          console.error(`xtext-worker: folklore index write failed for job ${job.jobId} (txid ${job.inscriptionTxid}) — the inscription is on chain and the board is behind; retrying next tick`);
          return;
        }

        await advance(job.jobId, { kind: "registered" }, nowMs);
        return;
      }

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
      if (utxos.length === 0) {
        // An empty address can mean the funding was already SPENT — by the
        // very inscription whose broadcast reported failure. Only the job
        // key could have spent it, so when the recorded attempted txid is
        // visible on the network, the failure report was a lie: route the
        // job back to the inscribed rails (inscription-found) so
        // registration completes and the visitor gets what they paid for.
        // Never while a sweep is in flight — two live spends of the same
        // funding must resolve on the sweep rails.
        if (job.attemptedInscriptionTxid && !job.sweepTxid) {
          const seenHex = await fetchRawTxHex(job.attemptedInscriptionTxid, fetchFn);
          if (seenHex) {
            await advance(job.jobId, { kind: "inscription-found", txid: job.attemptedInscriptionTxid }, nowMs);
            return;
          }
        }
        return; // nothing on the address yet — retry next tick
      }

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

      const loaded = loadJobKeyDetailed(job.jobId, wrapKey, jobsDir);
      if (!loaded.key) {
        warnOnce(
          warnedMissingKey,
          job.jobId,
          loaded.authFailed
            ? `xtext-worker: sweeping job ${job.jobId} has a custody key the wrapping key CANNOT OPEN — the wrapping key is wrong; restore it, do not reseed — flagged for ops`
            : `xtext-worker: sweeping job ${job.jobId} has no custody key on disk — flagged for ops`,
        );
        return;
      }
      const jobKey = loaded.key;

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
          // An empty read is NOT enough while a late-straggler sweep is
          // unconfirmed: its unbroadcast-yet-unmined spend hides the outputs
          // from the unspent view, and if that sweep were later dropped the
          // outputs would reappear with no key left to spend them. The
          // durable marker (written at broadcast, below) survives restarts;
          // the reap waits for the marker's transaction to confirm.
          const lateSweepTxid = readLateSweep(job.jobId, jobsDir);
          if (lateSweepTxid && !(await fetchTxConfirmed(lateSweepTxid, fetchFn))) {
            return; // sweep in flight — postpone the reap until it confirms
          }
          deleteJobKey(job.jobId, jobsDir); // affirmatively empty and past the window — custody ends here
          clearLateSweep(job.jobId, jobsDir);
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

      const loaded = loadJobKeyDetailed(job.jobId, wrapKey, jobsDir);
      if (!loaded.key) {
        warnOnce(
          warnedLateStraggler,
          job.jobId,
          loaded.authFailed
            ? `xtext-worker: late straggler on terminal job ${job.jobId} but its custody key CANNOT BE OPENED — the wrapping key is wrong; restore it, do not reseed — flagged for ops`
            : `xtext-worker: late straggler on terminal job ${job.jobId} but its key was already reaped — flagged for ops`,
        );
        return;
      }
      const jobKey = loaded.key;

      const built = await buildSweepTx({ jobKey, fundings: utxos, refundAddress, feeRate });
      if (built.ok === false) {
        // Warn once, not every tick — a dust straggler sits on the address for
        // the rest of the window and there is nothing broadcastable to do with it.
        warnOnce(warnedLateStraggler, job.jobId, `xtext-worker: late straggler on terminal job ${job.jobId} is dust — nothing broadcastable`);
        return;
      }

      // Durable BEFORE the broadcast — write-ahead, not write-behind. The
      // build is deterministic, so built.txid is the txid the network will
      // see; a crash between a successful broadcast and a later record would
      // leave an in-flight spend the reaper cannot see (empty read, no
      // marker → key deleted → a dropped sweep resurrects outputs with no
      // key: the F3 loss). A marker whose broadcast is then refused is
      // cleared on the spot; if that clear is itself lost to a crash, the
      // cost is a postponed reap — never a lost key.
      recordLateSweep(job.jobId, built.txid, jobsDir);
      const broadcast = await broadcastArchive(built.hex, { fetchFn, taalApiKey });
      if (!broadcast.ok) {
        clearLateSweep(job.jobId, jobsDir);
        return; // retry next tick
      }
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

  // The float pool is softer than the revenue address: unset only means
  // kudos-float jobs refuse and refund (said out loud here); set-but-invalid
  // is a configuration lie and refuses to start like the revenue address.
  const poolAddress = process.env.XTEXT_FLOAT_POOL_ADDRESS ?? "";
  const poolError = floatPoolAddressError(poolAddress);
  if (poolAddress.length > 0 && poolError) {
    console.error(`xtext-worker refusing to start: ${poolError}`);
    process.exit(1);
  }
  if (poolError) {
    console.warn(`xtext-worker: ${poolError} — until then a job carrying a kudos float leg refuses to inscribe and refunds itself.`);
  }
}

// Only when run directly (node worker.mjs), never on import — so a test that
// imports this module never triggers the process exit.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
