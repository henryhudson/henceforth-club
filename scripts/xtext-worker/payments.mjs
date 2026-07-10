// Money arrives; this module decides what it means. matchPayment and
// refundAddressOf are pure — no network, no clock — so the boundary that
// actually funds a job (unconditionally, once the state machine sees
// payment-seen) lives entirely in code that a test can pin exactly. The
// watch loop below is the only impure part: it polls WhatsOnChain, reads
// the clock once at the edge, and turns the pure answer into an event
// through advance().

import { PublicKey, Transaction } from "@bsv/sdk";

const WOC = "https://api.whatsonchain.com/v1/bsv/main";

/**
 * Which single output, if any, satisfies the price. The inscription spends
 * exactly one input, so the largest output at or above priceSats wins;
 * several small legs summing past the price are short, not funded — a
 * documented v1 simplification that rides the expiry sweep instead of a
 * multi-input funding path.
 */
export function matchPayment(utxos, priceSats) {
  if (utxos.length === 0) return { kind: "none" };

  let largest = utxos[0];
  for (const utxo of utxos) {
    if (utxo.sats > largest.sats) largest = utxo;
  }

  if (largest.sats >= priceSats) {
    return { kind: "funded", funding: { txid: largest.txid, vout: largest.vout, sats: largest.sats } };
  }

  return { kind: "short", totalSats: utxos.reduce((sum, u) => sum + u.sats, 0) };
}

/**
 * The address behind a funding transaction's first input — where an
 * auto-swept refund goes home to. Standard peer-to-peer-key-hash unlocks
 * only: exactly two data pushes, a signature then a public key. Anything
 * else (multisig, script-path spends, an empty or malformed transaction)
 * is null rather than a guess — the caller decides what an unresolved
 * refund address means for the job, this function only ever reports what
 * the chain actually shows.
 */
export function refundAddressOf(rawFundingTx) {
  let tx;
  try {
    tx = Transaction.fromHex(rawFundingTx);
  } catch {
    return null;
  }

  const unlockingScript = tx.inputs[0]?.unlockingScript;
  if (!unlockingScript) return null;

  const chunks = unlockingScript.chunks;
  if (chunks.length !== 2 || !chunks[0].data || !chunks[1].data) return null;

  // Compressed keys (33 bytes) only. The sdk also parses 65-byte
  // uncompressed and hybrid keys, but toAddress() always re-encodes
  // compressed — which is a DIFFERENT address from the one an
  // uncompressed-key wallet watches. Refunding there would strand the
  // money, so anything but 33 bytes is null: never a guess.
  if (chunks[1].data.length !== 33) return null;

  try {
    return PublicKey.fromDER(chunks[1].data).toAddress();
  } catch {
    return null; // the second push wasn't a valid public key encoding
  }
}

/**
 * One unspent-outputs read that distinguishes a genuine empty answer from a
 * failed one: { ok: true, utxos } on a good 200 (the array may be empty),
 * { ok: false } on any network error, non-200, or unexpected body. The reaper
 * (worker.mjs) needs this distinction before it deletes a fund-linked custody
 * key — an empty array that was really a failed read must not be mistaken for
 * "no funds on this address". Payment-watch call sites, which only ever want
 * "what did I see this tick", use fetchUnspentOutputs below instead.
 */
export async function readUnspentOutputs(address, fetchFn) {
  let res;
  try {
    res = await fetchFn(`${WOC}/address/${address}/unspent`);
  } catch {
    return { ok: false };
  }
  if (!res.ok) return { ok: false };
  let body;
  try {
    body = await res.json();
  } catch {
    return { ok: false };
  }
  if (!Array.isArray(body)) return { ok: false };
  return { ok: true, utxos: body.map((o) => ({ txid: o.tx_hash, vout: o.tx_pos, sats: o.value })) };
}

/** One unspent-outputs request, shaped for matchPayment. Any read failure
 * (network error, non-200, an unexpected body) answers "nothing seen yet"
 * rather than throwing — the next tick tries again. Exported so the sweep and
 * late watch (worker.mjs) read the address the same way, never a second poll
 * implementation. */
export async function fetchUnspentOutputs(address, fetchFn) {
  const read = await readUnspentOutputs(address, fetchFn);
  return read.ok ? read.utxos : [];
}

/** The funding transaction's raw hex, or null on any read failure. Exported
 * for the sweep, which resolves the refund address from the funding
 * transaction's first input exactly as the payment watch does. */
export async function fetchRawTxHex(txid, fetchFn) {
  let res;
  try {
    res = await fetchFn(`${WOC}/tx/${txid}/hex`);
  } catch {
    return null;
  }
  return res.ok ? await res.text() : null;
}

/** Whether a broadcast transaction has its first confirmation yet. Any read
 * failure or an as-yet-unconfirmed transaction answers false — the sweep waits
 * and asks again next tick. The sweep records its broadcast (sweep-broadcast)
 * immediately, but only advances to swept once this reports a confirmation. */
export async function fetchTxConfirmed(txid, fetchFn) {
  let res;
  try {
    res = await fetchFn(`${WOC}/tx/hash/${txid}`);
  } catch {
    return false;
  }
  if (!res.ok) return false;
  let body;
  try {
    body = await res.json();
  } catch {
    return false;
  }
  return typeof body.confirmations === "number" && body.confirmations > 0;
}

/**
 * advance() through the two refusals that are routine, not bugs:
 * version-conflict (a concurrent writer beat this tick to the job — advance
 * re-reads on every call, so trying the same event again is the retry) and
 * any other, already-terminal refusal (a replayed event onto a job the
 * sweep already finished), which is left alone as a benign no-op.
 */
async function emit(advance, jobId, event, nowMs) {
  const result = await advance(jobId, event, nowMs);
  if (!result.ok && result.refused === "version-conflict") {
    return advance(jobId, event, nowMs);
  }
  return result;
}

/**
 * One polling tick. Quoted jobs past their quote expire without a network
 * call — they have no address yet. Awaiting-payment jobs cost exactly one
 * unspent-outputs request each, made sequentially (politeness toward the
 * rate limit, matching the existing style in src/lib/whatsonchain.ts) and
 * reused for both the funding check and, should that miss, the expiry
 * residue — never two requests for the same job in one tick.
 */
export async function runWatchTick({ listJobsInState, advance, fetchFn = fetch, nowMs }) {
  const quoted = await listJobsInState("quoted");
  for (const job of quoted) {
    if (nowMs >= job.expiresAtMs) {
      await emit(advance, job.jobId, { kind: "expired", residueSats: 0 }, nowMs);
    }
  }

  const awaitingPayment = await listJobsInState("awaiting-payment");
  for (const job of awaitingPayment) {
    const utxos = await fetchUnspentOutputs(job.address, fetchFn);
    const match = matchPayment(utxos, job.priceSats);

    if (match.kind === "funded") {
      const rawTx = await fetchRawTxHex(match.funding.txid, fetchFn);
      const refundAddress = rawTx ? refundAddressOf(rawTx) : null;
      if (refundAddress) {
        await emit(
          advance,
          job.jobId,
          {
            kind: "payment-seen",
            txid: match.funding.txid,
            vout: match.funding.vout,
            sats: match.funding.sats,
            refundAddress,
          },
          nowMs,
        );
        continue;
      }
      // Funded by an input this module can't attribute a refund address to.
      // Not guessed — flagged, and left to the expiry scan below like any
      // other unresolved job (a later task's sweep resolves refunds per
      // residual output, not this one).
      console.warn(
        `xtext-worker: job ${job.jobId} funded by a non-standard input — no refund address, flagged for ops`,
      );
    }

    if (nowMs >= job.expiresAtMs) {
      const residueSats = utxos.reduce((sum, u) => sum + u.sats, 0);
      await emit(advance, job.jobId, { kind: "expired", residueSats }, nowMs);
    }
  }
}
