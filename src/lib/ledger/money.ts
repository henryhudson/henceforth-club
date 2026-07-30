// Money is held as a signed decimal string and computed as integer pence.
//
// The spreadsheet this ledger replaces stored its 2023 total as
// 2589.659999999998 — IEEE-754 binary floating point cannot represent £0.01,
// so sums of pounds accumulate error. A JavaScript `number` is that same type.
// Pence are integers, and integers below 2^53 are exact.

const AMOUNT = /^(-?)(\d+)\.(\d{2})$/;

/** Signed pence, or null when the string is not exactly a two-place figure. */
export function parseAmount(s: string): number | null {
  const match = AMOUNT.exec(s ?? "");
  if (!match) return null;
  const [, sign, whole, fraction] = match;
  const pence = Number(whole) * 100 + Number(fraction);
  if (!Number.isSafeInteger(pence)) return null;
  return sign === "-" ? -pence : pence;
}

export function formatPence(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const absolute = Math.abs(pence);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

/**
 * Malformed entries contribute nothing. Validation rejects them before they
 * reach the store, so a non-zero contribution here would hide a bug rather
 * than tolerate one.
 */
export function sumPence(amounts: string[]): number {
  return amounts.reduce((total, amount) => total + (parseAmount(amount) ?? 0), 0);
}
