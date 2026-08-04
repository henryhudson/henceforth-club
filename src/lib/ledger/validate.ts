import { parseAmount } from "./money";
import { periodFor } from "./periods";
import type { Transaction } from "./types";

// The same rules ~/Henceforth/ledger/check.py enforces, so a row entered on the
// page and a row typed into the exported file are judged identically.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Round-tripping through Date catches dates that match the shape but do not
 * exist — 2025-02-30 parses to 2 March, so the round trip disagrees.
 */
function isRealDate(s: string): boolean {
  const parsed = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s;
}

/** Field-prefixed messages, one per problem. Empty means valid. */
export function validateTransaction(t: Partial<Transaction>): string[] {
  const errors: string[] = [];
  const date = t.date ?? "";

  if (!ISO_DATE.test(date) || !isRealDate(date)) {
    errors.push(
      `date: ${JSON.stringify(date)} must be YYYY-MM-DD — a spreadsheet application may have rewritten it on save`,
    );
  } else if (!periodFor(date)) {
    // Only a date that actually parses can be asked which period it belongs to.
    errors.push(`date: ${date} falls outside every known accounting period`);
  }

  if (parseAmount(t.amount ?? "") === null) {
    errors.push(
      `amount: ${JSON.stringify(t.amount ?? "")} must be signed with exactly two decimal places, for example -19.00 or 6.07`,
    );
  }

  if (!(t.description ?? "").trim()) {
    errors.push("description: must not be empty");
  }

  return errors;
}
