// The sweep: every failure path ends with the visitor's money back. Where the
// inscription spends one funding output forward, the sweep spends every unspent
// output on the job's custody address BACK to the payer — one transaction, one
// output of sum minus fee to the refund address. An underpaid job may hold
// several small legs and a duplicate payment may have landed after funding, so
// the caller fetches the unspent set at sweep time and hands it here as an
// array; this builder spends them all. Runs on the Mac mini worker only.
//
// buildSweepTx is a value-returning builder in the same shape as
// inscribe.mjs's buildInscriptionTx: it never throws for the residue that is
// too small to sweep, it refuses. The refusal is the honest answer — a residue
// at or below the dust threshold cannot become a standard, broadcastable
// output, so no transaction is built.

import { P2PKH, SatoshisPerKilobyte, Transaction } from "@bsv/sdk";

// The standard compressed-key P2PKH dust floor. An output at or below this is
// uneconomic to spend and miners treat it as non-standard, so a sweep whose
// single output would land here cannot be broadcast — the builder refuses
// rather than emit an unbroadcastable transaction. The pound-scale web quote
// makes a genuine dust residue an edge, never a path.
const DUST_LIMIT_SATS = 546;

/**
 * Build the sweep transaction: one input per unspent leg on the custody
 * address (all locked to the job key's P2PKH, so the one key signs them all),
 * and one output of sum minus fee to the refund address. The fee is implicit —
 * there is no change output — so the output absorbs exactly the miner fee, and
 * the fee is size-based and conservative: the 108-byte unlock estimate the
 * fee model reads before signing is a hair above a real signature, so the fee
 * paid is never short of the real serialized size at feeRate (mirroring
 * inscribe.mjs).
 *
 * Returns { hex, txid } on success. When sum minus fee is at or below the dust
 * threshold it refuses as a value — { ok: false, reason: "dust" } — never a
 * throw and never an unbroadcastable transaction.
 */
export async function buildSweepTx({ jobKey, fundings, refundAddress, feeRate }) {
  const tx = new Transaction();

  // Deterministic input order regardless of how the unspent poll happened to
  // return the legs — the poll's ordering is not stable across ticks, and the
  // retry contract replays the SAME txid, so the legs are canonicalised by
  // (txid, vout) before anything touches the transaction.
  const orderedFundings = [...fundings].sort(
    (a, b) => (a.txid < b.txid ? -1 : a.txid > b.txid ? 1 : a.vout - b.vout),
  );

  // Every unspent leg pays the same custody address, so all share the job
  // key's P2PKH locking script and one key unlocks them. Supplying the amount
  // and locking script directly lets each input sign without fetching its
  // parent — the outpoint alone ties it to the real coin (mirroring inscribe).
  const custodyLockingScript = new P2PKH().lock(jobKey.toAddress());
  for (const funding of orderedFundings) {
    tx.addInput({
      sourceTXID: funding.txid,
      sourceOutputIndex: funding.vout,
      unlockingScriptTemplate: new P2PKH().unlock(jobKey, "all", false, funding.sats, custodyLockingScript),
      sequence: 0xffffffff,
    });
  }

  const sum = fundings.reduce((total, f) => total + f.sats, 0);

  // A placeholder value first: the output's serialized size (and therefore the
  // fee) is independent of the amount, so the fee computed here is the final
  // fee. The real refund value is written once the fee is known.
  tx.addOutput({ lockingScript: new P2PKH().lock(refundAddress), satoshis: sum });

  const fee = await new SatoshisPerKilobyte(feeRate).computeFee(tx);
  const refundSats = sum - fee;
  if (refundSats <= DUST_LIMIT_SATS) {
    return { ok: false, reason: "dust" };
  }

  tx.outputs[0].satoshis = refundSats;
  await tx.sign();
  return { hex: tx.toHex(), txid: tx.id("hex") };
}
