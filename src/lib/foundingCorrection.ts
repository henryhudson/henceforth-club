// The media-weight founding correction, pure — rebuilt after the 2026-07-17
// adversarial review (unanimous DO_NOT_SHIP on v1) whose referee confirmed
// v1's premise was wrong twice over: the per-transaction fee is NOT the sum
// of current ledger entries (four of seven transactions had drifted from the
// chain's real fee), and grouping by the LEDGER entry's txid pooled 45
// media posts under the genesis transaction they no longer live in.
//
// The corrected contract:
//   - Fees are INPUTS, fetched from the chain by the caller and cross-checked
//     there. The plan conserves the chain fee per transaction, exactly.
//   - Grouping is by the post's ARCHIVE txid (where the post actually lives),
//     so a drifted entry is replayed under its true transaction.
//   - The plan is a pure function of the ledger SET: entries are sorted by
//     postId within each transaction before the split, so no ledger
//     permutation (including the executor's own strike-and-append reorder)
//     changes the outcome.
//   - Ledger-vs-chain drift per transaction is REPORTED, never silently
//     conserved.
//
// Nothing here reads a network or a clock; non-founding votes are untouched.

import { splitFeeByWeights } from "./foundingBackfill";
import { isFoundingEntry, type VoteLedgerEntry } from "./xScore";

export type PostWeightInput = {
  id: string;
  /** The post's ARCHIVE txid — the transaction the post actually lives in. */
  txid?: string;
  textBytes: number;
  /** Byte size of each media item inscribed with this post. */
  mediaBytes: readonly number[];
};

export type FoundingChange = {
  postId: string;
  /** The post's true (archive) transaction — the replay inscribes under it. */
  txid: string;
  /** The ledger entry being struck (exact value match for removal). */
  oldEntry: VoteLedgerEntry;
  oldSats: number;
  newSats: number;
  /** The original inscription day, preserved verbatim in the replay. */
  day: string;
};

export type CorrectionPlan = {
  changes: FoundingChange[];
  /** Non-founding votes seen and deliberately left alone. */
  untouchedVotes: number;
  /** The chain fee each transaction's shares sum to (the conservation target). */
  feeByTx: Record<string, number>;
  /** chain fee − current ledger sum, per transaction: the drift the v1 plan
   * would have conserved. Zero means the ledger already matched the chain. */
  ledgerDriftByTx: Record<string, number>;
};

export function planFoundingCorrection(
  ledger: readonly VoteLedgerEntry[],
  posts: readonly PostWeightInput[],
  chainFeeByTx: Record<string, number>,
): CorrectionPlan {
  const postById = new Map(posts.map((p) => [p.id, p]));
  const untouchedVotes = ledger.filter((e) => !isFoundingEntry(e)).length;

  // Group by the post's ARCHIVE txid. A ledger post missing from the archive
  // makes its transaction's split uncomputable — refuse outright.
  const byTx = new Map<string, { entry: VoteLedgerEntry; post: PostWeightInput }[]>();
  for (const entry of ledger) {
    if (!isFoundingEntry(entry)) continue;
    const post = postById.get(entry.postId);
    if (!post) throw new Error(`ledger post ${entry.postId} missing from archive input`);
    const tx = post.txid ?? "";
    const list = byTx.get(tx) ?? [];
    list.push({ entry, post });
    byTx.set(tx, list);
  }

  const changes: FoundingChange[] = [];
  const feeByTx: Record<string, number> = {};
  const ledgerDriftByTx: Record<string, number> = {};

  for (const [tx, group] of byTx) {
    const fee = chainFeeByTx[tx];
    if (!Number.isFinite(fee) || fee === undefined) {
      throw new Error(`no chain fee supplied for transaction ${tx}`);
    }
    // Order-invariance: the split (and its largest-remainder tie-breaks)
    // must not depend on ledger order, so sort by postId first.
    group.sort((a, b) => (a.post.id < b.post.id ? -1 : a.post.id > b.post.id ? 1 : 0));

    feeByTx[tx] = fee;
    ledgerDriftByTx[tx] = fee - group.reduce((s, g) => s + g.entry.sats, 0);

    const weights = group.map(
      (g) => Math.max(0, g.post.textBytes) + g.post.mediaBytes.reduce((s, b) => s + Math.max(0, b), 0),
    );
    const corrected = splitFeeByWeights(fee, weights);

    const total = corrected.reduce((s, v) => s + v, 0);
    if (total !== fee) throw new Error(`conservation broken for tx ${tx}: ${total} != ${fee}`);

    group.forEach((g, i) => {
      const movedTx = g.entry.txid.includes(":") ? g.entry.txid.slice(0, g.entry.txid.indexOf(":")) !== tx : false;
      if (corrected[i] === g.entry.sats && !movedTx) return;
      changes.push({
        postId: g.post.id,
        txid: tx,
        oldEntry: g.entry,
        oldSats: g.entry.sats,
        newSats: corrected[i],
        day: g.entry.day,
      });
    });
  }

  return { changes, untouchedVotes, feeByTx, ledgerDriftByTx };
}
