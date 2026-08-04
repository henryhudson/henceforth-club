import { sha256Hex } from "@/lib/board-auth";
import type { Transaction } from "./types";

// A Merkle tree over the transactions of one accounting period. The root goes
// on chain; the transactions do not. An inclusion proof then shows that one
// transaction was in the committed set without disclosing any of the others.
//
// Two construction rules here are load-bearing and cannot be changed once roots
// are broadcast, because a root is immutable the moment it is in a block.

export type ProofStep = { hash: string; side: "left" | "right" };

const FIELDS = [
  "id", "date", "account", "amount", "description", "category", "source",
] as const;

/**
 * Unit separator. Written as an escape rather than the literal byte: a raw
 * control character in source is invisible, and one careless editor save would
 * silently delete it and make the canonical form ambiguous.
 */
const SEPARATOR = "\u001f";

/**
 * Fixed field order, unit-separator delimited. Any two distinct transactions
 * must produce distinct strings, including when their text differs only in
 * where a field boundary falls — hence a delimiter rather than concatenation.
 */
export function canonicalise(t: Transaction): string {
  return FIELDS.map((field) =>
    String(t[field] ?? "").split(SEPARATOR).join(" "),
  ).join(SEPARATOR);
}

// Rule one: leaves and internal nodes are domain-separated by prefix, so a leaf
// hash can never be reinterpreted as an internal node (or the reverse).
export function leafHash(t: Transaction): Promise<string> {
  return sha256Hex(`L:${canonicalise(t)}`);
}

function nodeHash(left: string, right: string): Promise<string> {
  return sha256Hex(`N:${left}${right}`);
}

// Rule two: an odd node is carried up unchanged, never duplicated. Duplicating
// it would make [A,B,C] and [A,B,C,C] produce an identical root, so a set could
// be misrepresented as the one that was committed.
async function reduceLevel(level: string[]): Promise<string[]> {
  const next: string[] = [];
  for (let i = 0; i < level.length; i += 2) {
    next.push(i + 1 < level.length ? await nodeHash(level[i], level[i + 1]) : level[i]);
  }
  return next;
}

/** Leaves must already be in their committed order, conventionally sorted. */
export async function buildRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) throw new Error("cannot commit an empty period");
  let level = leaves;
  while (level.length > 1) level = await reduceLevel(level);
  return level[0];
}

/**
 * The sibling path from one leaf to the root. A level where the node is carried
 * up has no sibling and contributes no step, which is why verification replays
 * the recorded steps rather than assuming one per level.
 */
export async function buildProof(leaves: string[], index: number): Promise<ProofStep[]> {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
    throw new Error(`leaf index ${index} out of range for ${leaves.length} leaves`);
  }
  const steps: ProofStep[] = [];
  let level = leaves;
  let position = index;
  while (level.length > 1) {
    const isRightChild = position % 2 === 1;
    const siblingIndex = isRightChild ? position - 1 : position + 1;
    if (siblingIndex < level.length) {
      steps.push({ hash: level[siblingIndex], side: isRightChild ? "left" : "right" });
    }
    level = await reduceLevel(level);
    position = Math.floor(position / 2);
  }
  return steps;
}

export async function verifyProof(
  leaf: string,
  steps: ProofStep[],
  root: string,
): Promise<boolean> {
  let accumulated = leaf;
  for (const { hash, side } of steps) {
    accumulated =
      side === "left" ? await nodeHash(hash, accumulated) : await nodeHash(accumulated, hash);
  }
  return accumulated === root;
}
