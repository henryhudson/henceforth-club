import { describe, expect, it } from "vitest";
import { OP, PrivateKey, Transaction, Utils } from "@bsv/sdk";
import {
  FEE_CEILING_SATS,
  PERIODS,
  buildCommitmentTransaction,
  buildRoot,
  commitmentScript,
  fabricatedSource,
  formatPence,
  leafHash,
  netPence,
  planCommit,
  rowErrors,
} from "./commit-core.mjs";
import {
  buildProof,
  buildRoot as buildRootPage,
  canonicalise as canonicalisePage,
  leafHash as leafHashPage,
  verifyProof,
} from "@/lib/ledger/merkle";
import { formatPence as formatPencePage, sumPence } from "@/lib/ledger/money";
import { PERIODS as PERIODS_PAGE } from "@/lib/ledger/periods";
import { validateTransaction } from "@/lib/ledger/validate";

// The script cannot import TypeScript, so commit-core.mjs mirrors the page's
// hashing, periods and money rules. These tests pin the two implementations
// together: if either drifts, the suite goes red before a root is broadcast
// against leaves the page cannot verify.

const tx = (id, amount, over = {}) => ({
  id,
  date: "2025-01-15",
  account: "HSBC (debit)",
  amount,
  description: "IPHONE PAYMENT",
  category: "Phone",
  source: "HSBC 2025-01-19",
  ...over,
});

const FIVE = [
  tx("t1", "-49.95"),
  tx("t2", "-429.00", { date: "2025-02-12", account: "Amex (credit)", description: "APPLE STORE" }),
  tx("t3", "-19.00", { date: "2025-03-01", account: "NatWest", description: "GIGACLEAR WIFI" }),
  tx("t4", "6.07", { date: "2025-04-05", description: "APP REVENUE APRIL", category: "App revenue" }),
  tx("t5", "-13.00", { date: "2025-05-20", description: "COMPANIES HOUSE FEE" }),
];

describe("agreement with the page", () => {
  it("hashes every leaf to the same value", async () => {
    for (const t of FIVE) {
      expect(leafHash(t)).toBe(await leafHashPage(t));
    }
  });

  it("builds the same root, including the odd count that carries a node up", async () => {
    for (const set of [FIVE, FIVE.slice(0, 4)]) {
      const leaves = set.map(leafHash).sort();
      expect(buildRoot(leaves)).toBe(await buildRootPage(leaves));
    }
  });

  it("survives a field that contains the canonical separator", async () => {
    const awkward = tx("t9", "-1.00", { description: "A\u001fB" });
    expect(canonicalisePage(awkward)).toContain("A B");
    expect(leafHash(awkward)).toBe(await leafHashPage(awkward));
  });

  it("commits roots the page's proofs verify against", async () => {
    // The full circle: this script commits, the proof endpoint proves.
    const plan = planCommit({ periodId: "2025-01-01_2025-12-31", transactions: FIVE });
    expect(plan.ok).toBe(true);
    const { leaves, root } = plan.commitment;
    for (let i = 0; i < leaves.length; i++) {
      expect(await verifyProof(leaves[i], await buildProof(leaves, i), root)).toBe(true);
    }
  });

  it("knows the same accounting periods", () => {
    expect(PERIODS).toEqual(PERIODS_PAGE.map((p) => ({ ...p })));
  });

  it("judges row shape the way validateTransaction does", () => {
    const rows = [
      tx("g1", "-19.00"),
      tx("b1", "-19.00", { date: "19/08/2025" }),
      tx("b2", "-19"),
      tx("b3", "-19.00", { description: "  " }),
      tx("b4", "-19.00", { date: "2025-02-30" }),
    ];
    for (const row of rows) {
      expect(rowErrors(row).length === 0).toBe(validateTransaction(row).length === 0);
    }
  });

  it("sums and formats pence the way the page does", () => {
    const amounts = FIVE.map((t) => t.amount);
    expect(netPence(FIVE)).toBe(sumPence(amounts));
    expect(formatPence(netPence(FIVE))).toBe(formatPencePage(sumPence(amounts)));
    expect(formatPence(-79764)).toBe("-797.64");
  });
});

describe("planCommit", () => {
  const PERIOD_2025 = "2025-01-01_2025-12-31";

  it("selects only the period's rows and orders leaves canonically", () => {
    const outside = tx("t8", "-1.00", { date: "2024-06-01" });
    const plan = planCommit({ periodId: PERIOD_2025, transactions: [...FIVE, outside] });
    expect(plan.ok).toBe(true);
    expect(plan.commitment.count).toBe(5);
    expect(plan.commitment.transactionIds).not.toContain("t8");
    expect(plan.commitment.leaves).toEqual([...plan.commitment.leaves].sort());
    // transactionIds stay parallel to leaves: each names the row its leaf hashes.
    plan.commitment.leaves.forEach((leaf, i) => {
      const named = FIVE.find((t) => t.id === plan.commitment.transactionIds[i]);
      expect(leafHash(named)).toBe(leaf);
    });
  });

  it("is a function of the set, not of insertion order", () => {
    const a = planCommit({ periodId: PERIOD_2025, transactions: FIVE });
    const b = planCommit({ periodId: PERIOD_2025, transactions: [...FIVE].reverse() });
    expect(a.commitment).toEqual(b.commitment);
  });

  it("refuses a period it does not know", () => {
    const plan = planCommit({ periodId: "2027-01-01_2027-12-31", transactions: FIVE });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("unknown period");
  });

  it("refuses an empty period", () => {
    const plan = planCommit({ periodId: "2026-01-01_2026-12-31", transactions: FIVE });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("no transactions");
  });

  it("refuses a malformed row, naming it", () => {
    const bad = tx("t6", "-19", { date: "2025-06-01" });
    const plan = planCommit({ periodId: PERIOD_2025, transactions: [...FIVE, bad] });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("t6");
    expect(plan.reason).toContain("amount");
  });

  it("refuses duplicate identifiers, which would make proofs ambiguous", () => {
    const plan = planCommit({ periodId: PERIOD_2025, transactions: [...FIVE, tx("t1", "-2.00")] });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toContain("t1");
  });

  it("refuses an already-committed period unless superseding", () => {
    const existingCommit = { root: "a".repeat(64) };
    const refused = planCommit({ periodId: PERIOD_2025, transactions: FIVE, existingCommit });
    expect(refused.ok).toBe(false);
    expect(refused.reason).toContain("--supersede");

    const amended = planCommit({ periodId: PERIOD_2025, transactions: FIVE, existingCommit, supersede: true });
    expect(amended.ok).toBe(true);
    expect(amended.commitment.supersedes).toBe("a".repeat(64));
  });

  it("carries no supersedes field on a first commitment", () => {
    const plan = planCommit({ periodId: PERIOD_2025, transactions: FIVE });
    expect("supersedes" in plan.commitment).toBe(false);
  });
});

describe("the commitment output", () => {
  const commitment = {
    periodId: "2025-01-01_2025-12-31",
    root: "ab".repeat(32),
    count: 5,
  };

  const dataChunks = (script) =>
    script.chunks.filter((c) => c.data?.length).map((c) => Utils.toUTF8(c.data));

  it("is an unspendable output carrying marker, version, period, root and count", () => {
    const script = commitmentScript(commitment);
    expect(script.chunks[0].op).toBe(OP.OP_FALSE);
    expect(script.chunks[1].op).toBe(OP.OP_RETURN);
    expect(dataChunks(script)).toEqual(["HFLEDGER", "1", commitment.periodId, commitment.root, "5"]);
  });

  it("appends the superseded root when amending", () => {
    const script = commitmentScript({ ...commitment, supersedes: "cd".repeat(32) });
    expect(dataChunks(script).at(-1)).toBe("cd".repeat(32));
  });
});

describe("the transaction", () => {
  // A throwaway key: generated here, funded nowhere, spent never.
  const key = PrivateKey.fromRandom();

  it("prices, signs, and keeps its change on a fabricated source", async () => {
    const source = fabricatedSource(key.toAddress());
    const built = await buildCommitmentTransaction({
      privateKey: key,
      sourceTransaction: source,
      sourceOutputIndex: 0,
      lockingScript: commitmentScript({ periodId: "2025-01-01_2025-12-31", root: "ab".repeat(32), count: 5 }),
    });

    expect(built.outputs[0].satoshis).toBe(0);
    expect(built.getFee()).toBeLessThanOrEqual(FEE_CEILING_SATS);
    const change = built.outputs.find((o) => o.change === true && (o.satoshis ?? 0) > 0);
    expect(change).toBeDefined();

    // The hex decodes, and the decoded output script still carries the root.
    const rootUtf8Hex = Buffer.from("ab".repeat(32), "utf8").toString("hex");
    const decoded = Transaction.fromHex(built.toHex());
    expect(decoded.outputs[0].lockingScript.toHex()).toContain(rootUtf8Hex);
  });

  it("refuses to sign when the fee would consume the whole input", async () => {
    // The sdk's fee() silently DELETES the change output when change <= 0; an
    // unguarded build would burn the entire input as miner fee.
    const source = fabricatedSource(key.toAddress(), 10);
    await expect(
      buildCommitmentTransaction({
        privateKey: key,
        sourceTransaction: source,
        sourceOutputIndex: 0,
        lockingScript: commitmentScript({ periodId: "2025-01-01_2025-12-31", root: "ab".repeat(32), count: 5 }),
      }),
    ).rejects.toThrow(/refusing to sign/);
  });
});
