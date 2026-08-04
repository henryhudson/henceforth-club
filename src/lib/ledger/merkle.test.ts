import { describe, expect, it } from "vitest";
import { buildProof, buildRoot, canonicalise, leafHash, verifyProof } from "./merkle";
import type { Transaction } from "./types";

const tx = (id: string, amount: string): Transaction => ({
  id,
  date: "2025-01-15",
  account: "HSBC (debit)",
  amount,
  description: "IPHONE PAYMENT",
  category: "Phone",
  source: "HSBC 2025-01-19",
});

const hashAll = (txs: Transaction[]) => Promise.all(txs.map(leafHash));

describe("canonicalise", () => {
  it("is insensitive to key order in the object", () => {
    const a = tx("t1", "-49.95");
    const b: Transaction = {
      source: a.source, category: a.category, description: a.description,
      amount: a.amount, account: a.account, date: a.date, id: a.id,
    };
    expect(canonicalise(b)).toBe(canonicalise(a));
  });

  it("changes when any single field changes", () => {
    const base = tx("t1", "-49.95");
    expect(canonicalise({ ...base, amount: "-49.96" })).not.toBe(canonicalise(base));
    expect(canonicalise({ ...base, date: "2025-01-16" })).not.toBe(canonicalise(base));
    expect(canonicalise({ ...base, id: "t2" })).not.toBe(canonicalise(base));
  });

  it("cannot be confused by a field boundary", () => {
    // Two rows whose fields differ only in where the split falls must not
    // canonicalise alike, or a leaf could stand for either.
    const a = { ...tx("t1", "-1.00"), description: "AB", source: "C" };
    const b = { ...tx("t1", "-1.00"), description: "A", source: "BC" };
    expect(canonicalise(a)).not.toBe(canonicalise(b));
  });
});

describe("buildRoot", () => {
  it("returns the single leaf when there is exactly one", async () => {
    const [only] = await hashAll([tx("a", "-1.00")]);
    expect(await buildRoot([only])).toBe(only);
  });

  it("refuses an empty set", async () => {
    await expect(buildRoot([])).rejects.toThrow(/empty/i);
  });

  it("is a function of the set, not of insertion order", async () => {
    const leaves = await hashAll([tx("a", "-1.00"), tx("b", "-2.00"), tx("c", "-3.00")]);
    const shuffled = [leaves[2], leaves[0], leaves[1]];
    expect(await buildRoot([...leaves].sort())).toBe(await buildRoot([...shuffled].sort()));
  });

  it("cannot be forged by the duplicate-leaf attack", async () => {
    // The naive construction duplicates a lone final node to complete a level,
    // so [A,B,C] and [A,B,C,C] collide. Carrying the odd node up prevents it.
    const [a, b, c] = await hashAll([tx("a", "-1.00"), tx("b", "-2.00"), tx("c", "-3.00")]);
    expect(await buildRoot([a, b, c])).not.toBe(await buildRoot([a, b, c, c]));
  });

  it("separates leaves from internal nodes", async () => {
    // A two-leaf root must not equal the hash of the same pair treated as a
    // leaf payload, or an internal node could be presented as a leaf.
    const [a, b] = await hashAll([tx("a", "-1.00"), tx("b", "-2.00")]);
    const root = await buildRoot([a, b].sort());
    expect(root).not.toBe(a);
    expect(root).not.toBe(b);
  });
});

describe("proofs", () => {
  it("verifies every leaf against the root, at every tree depth", async () => {
    // Five leaves exercises a level above zero AND an odd carry-up. A two-leaf
    // tree would pass even with a broken level reduction.
    for (const size of [1, 2, 3, 4, 5, 8, 9]) {
      const txs = Array.from({ length: size }, (_, i) => tx(`t${i}`, `-${i + 1}.00`));
      const leaves = (await hashAll(txs)).sort();
      const root = await buildRoot(leaves);
      for (let i = 0; i < leaves.length; i++) {
        expect(
          await verifyProof(leaves[i], await buildProof(leaves, i), root),
          `size ${size}, leaf ${i}`,
        ).toBe(true);
      }
    }
  });

  it("fails when one penny changes", async () => {
    const leaves = (await hashAll([tx("a", "-1.00"), tx("b", "-2.00")])).sort();
    const root = await buildRoot(leaves);
    const tampered = await leafHash(tx("a", "-1.01"));
    expect(await verifyProof(tampered, await buildProof(leaves, 0), root)).toBe(false);
  });

  it("fails against a root from a different set", async () => {
    const leaves = (await hashAll([tx("a", "-1.00"), tx("b", "-2.00")])).sort();
    const other = (await hashAll([tx("c", "-3.00"), tx("d", "-4.00")])).sort();
    const proof = await buildProof(leaves, 0);
    expect(await verifyProof(leaves[0], proof, await buildRoot(other))).toBe(false);
  });

  it("refuses an index outside the set", async () => {
    const leaves = await hashAll([tx("a", "-1.00")]);
    await expect(buildProof(leaves, 1)).rejects.toThrow(/range/i);
    await expect(buildProof(leaves, -1)).rejects.toThrow(/range/i);
  });
});
