import type { Period } from "./types";

// Henceforth Bitcoin Limited, registration 13829963.
//
// The accounting reference date has moved twice. It began at 31 January, then
// was shortened to 31 December for the eleven-month period ending 2024-12-31.
// Calendar years only coincide with accounting periods from 2025 onward, which
// is why period membership is looked up here rather than derived from a year.
//
// Filed results for reference: £586.43, £2,596.67, and £526.27 (loss per
// accounts £598.00) respectively. The 2025 period is not yet filed.
const RANGES: ReadonlyArray<readonly [string, string, string]> = [
  ["2021-12-01", "2023-01-31", "incorporation to 31 January 2023"],
  ["2023-02-01", "2024-01-31", "01 February 2023 to 31 January 2024"],
  ["2024-02-01", "2024-12-31", "01 February 2024 to 31 December 2024"],
  ["2025-01-01", "2025-12-31", "01 January 2025 to 31 December 2025"],
  ["2026-01-01", "2026-12-31", "01 January 2026 to 31 December 2026"],
];

export const PERIODS: readonly Period[] = RANGES.map(([start, end, label]) => ({
  id: `${start}_${end}`,
  label,
  start,
  end,
}));

/**
 * Lexicographic comparison is correct here precisely because the dates are
 * ISO 8601: string order and chronological order coincide. That property is
 * the reason the conversion normalised them in the first place.
 */
export function periodFor(date: string): Period | null {
  return PERIODS.find((p) => date >= p.start && date <= p.end) ?? null;
}

export function periodById(id: string): Period | null {
  return PERIODS.find((p) => p.id === id) ?? null;
}
