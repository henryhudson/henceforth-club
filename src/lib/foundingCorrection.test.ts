import { describe, expect, it } from "vitest";
import { planFoundingCorrection, type PostWeightInput } from "./foundingCorrection";
import type { VoteLedgerEntry } from "./xScore";

const founding = (postId: string, sats: number, txid = "T1"): VoteLedgerEntry => ({
  txid: `${txid}:${postId}`, postId, dir: "up", sats, day: "2026-07-01", founding: true,
});

describe("planFoundingCorrection — chain fees in, archive-txid grouping, order-invariant", () => {
  it("splits the CHAIN fee (an input, never the ledger sum) by text+media weight, conserving it exactly", () => {
    // Ledger under-recorded: entries sum to 100,000 but the chain fee is 150,000.
    const ledger = [founding("p1", 40_000), founding("p2", 60_000)];
    const posts: PostWeightInput[] = [
      { id: "p1", txid: "T1", textBytes: 40, mediaBytes: [] },
      { id: "p2", txid: "T1", textBytes: 60, mediaBytes: [3_000_000] },
    ];
    const plan = planFoundingCorrection(ledger, posts, { T1: 150_000 });
    const p1 = plan.changes.find((c) => c.postId === "p1")!;
    const p2 = plan.changes.find((c) => c.postId === "p2")!;
    expect(p1.newSats + p2.newSats).toBe(150_000); // conserves the CHAIN fee
    expect(p2.newSats).toBeGreaterThan(149_000);
    expect(p1.day).toBe("2026-07-01");
    expect(plan.ledgerDriftByTx.T1).toBe(150_000 - 100_000); // the drift is REPORTED
  });

  it("groups a drifted entry by its post's ARCHIVE txid, not the stale ledger txid", () => {
    // The entry was recorded under GENESIS, but the post's archive txid is MEDIA
    // (re-inscribed with its video later). Its share must come from MEDIA's fee.
    const ledger = [founding("moved", 18, "GENESIS"), founding("stay", 18, "GENESIS")];
    const posts: PostWeightInput[] = [
      { id: "moved", txid: "MEDIA", textBytes: 50, mediaBytes: [1_000_000] },
      { id: "stay", txid: "GENESIS", textBytes: 50, mediaBytes: [] },
    ];
    const plan = planFoundingCorrection(ledger, posts, { GENESIS: 18, MEDIA: 500_000 });
    const moved = plan.changes.find((c) => c.postId === "moved")!;
    expect(moved.txid).toBe("MEDIA");           // replayed under the true transaction
    expect(moved.newSats).toBe(500_000);        // sole post in MEDIA → whole fee
    const stay = plan.changes.find((c) => c.postId === "stay");
    expect(stay).toBeUndefined();               // GENESIS: sole remaining post, 18 → 18
  });

  it("is a pure function of the ledger SET: any permutation yields the identical plan", () => {
    const ledger = [
      founding("a", 3, "T"), founding("b", 3, "T"), founding("c", 2, "T"),
    ];
    const posts: PostWeightInput[] = [
      { id: "a", txid: "T", textBytes: 40, mediaBytes: [] },
      { id: "b", txid: "T", textBytes: 40, mediaBytes: [] }, // tie with a
      { id: "c", txid: "T", textBytes: 25, mediaBytes: [] },
    ];
    const fees = { T: 8 };
    const base = planFoundingCorrection(ledger, posts, fees);
    const perm = planFoundingCorrection([...ledger].reverse(), posts, fees);
    expect(perm.changes).toEqual(base.changes);
  });

  it("refuses when a ledger post is missing from the archive input", () => {
    const ledger = [founding("p1", 400, "T3"), founding("p2", 600, "T3")];
    const posts: PostWeightInput[] = [{ id: "p1", txid: "T3", textBytes: 40, mediaBytes: [] }];
    expect(() => planFoundingCorrection(ledger, posts, { T3: 1000 })).toThrow(/missing/);
  });

  it("refuses when a grouping transaction has no chain fee supplied", () => {
    const ledger = [founding("p1", 400, "T4")];
    const posts: PostWeightInput[] = [{ id: "p1", txid: "T4", textBytes: 40, mediaBytes: [] }];
    expect(() => planFoundingCorrection(ledger, posts, {})).toThrow(/fee/);
  });

  it("never touches non-founding votes", () => {
    const vote: VoteLedgerEntry = { txid: "v1", postId: "p1", dir: "up", sats: 500, day: "2026-07-10" };
    const ledger = [founding("p1", 1000, "TA"), vote];
    const posts: PostWeightInput[] = [{ id: "p1", txid: "TA", textBytes: 10, mediaBytes: [] }];
    const plan = planFoundingCorrection(ledger, posts, { TA: 1000 });
    expect(plan.changes).toEqual([]);
    expect(plan.untouchedVotes).toBe(1);
  });
});
