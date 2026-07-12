// Pure scoring for the paid-vote ranking. A profile's votes live in an
// append-only ledger; a post's ranking score is a fold over that ledger as
// of an as-of day with optional windowing. Nothing here touches Redis or the
// clock — the ledger, the as-of day, and an optional window come in, a score
// table comes out — so any correction (a double-spent funding transaction, a
// tuning change) is an exact replay of the fold, never a patch to a cached
// number.

export type ScoreWindow = "day" | "week" | "month" | "year" | "all";
export const DEFAULT_WINDOW: ScoreWindow = "week";

export type VoteDirection = "up" | "down";

/** One verified vote, exactly as it sits in the `x:ledger:<handle>` list.
 * Append-only: entries are only ever added (or, on a correction such as a
 * double-spent funding transaction, removed and the fold replayed). */
export type VoteLedgerEntry = {
  /** The funding transaction id — the payment IS the vote, and counts once.
   * Founding entries use the composite `inscriptionTxid:postId` form. */
  txid: string;
  postId: string;
  dir: VoteDirection;
  /** Satoshis paid: the vote's full, undecayed weight. */
  sats: number;
  /** The UTC day the vote was verified, as YYYY-MM-DD (`dateKey` format) —
   * the date used for windowing the score fold. */
  day: string;
  /** Marks a founding entry — the post's upload cost. Optional because
   * entries written before 2026-07-12 carry only the composite-txid marker;
   * `isFoundingEntry` accepts either. */
  founding?: boolean;
};

/** A founding entry is the post's upload cost — the ranking's permanent
 * floor. Detected by the explicit flag or the composite `txid:postId` form
 * (a real funding txid is bare hex and never contains a colon). */
export function isFoundingEntry(entry: VoteLedgerEntry): boolean {
  return entry.founding === true || entry.txid.includes(":");
}

const MS_PER_DAY = 86_400_000;
const WINDOW_DAYS: Record<Exclude<ScoreWindow, "all">, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/** Whole days between a ledger day and the as-of day; NaN when either day
 * string is unreadable. Date-only strings parse as UTC midnight, so valid
 * inputs always land on an integer. */
function daysBetween(day: string, asOfDay: string): number {
  return (Date.parse(asOfDay) - Date.parse(day)) / MS_PER_DAY;
}

/** The lower day-bound (YYYY-MM-DD) for a window as of `asOfDay`, or null for "all". */
export function windowStartDay(
  window: ScoreWindow,
  asOfDay: string,
): string | null {
  if (window === "all") return null;
  const start = Date.parse(asOfDay) - WINDOW_DAYS[window] * MS_PER_DAY;
  return new Date(start).toISOString().slice(0, 10);
}

/**
 * The pure fold: an append-only ledger in, a score table out —
 * `score(post) = founding cost (always) + Σ votes (±sats) within the window`
 * as of `asOfDay`. The founding entry is the post's upload cost and is the
 * ranking's permanent floor — it never ages out of a window (the rule set
 * 2026-07-12: the cost of uploading is the initial score; received sats add
 * to it); only received votes are time-windowed. A vote whose day can't be
 * read contributes nothing, rather than turning the whole table to NaN.
 * Total: any ledger and any as-of day fold to a table.
 */
export function foldScores(
  ledger: readonly VoteLedgerEntry[],
  asOfDay: string,
  windowStart: string | null = null,
): Record<string, number> {
  return ledger.reduce<Record<string, number>>((table, entry) => {
    if (!isFoundingEntry(entry)) {
      if (Number.isNaN(daysBetween(entry.day, asOfDay))) return table; // unreadable day
      if (windowStart !== null && entry.day < windowStart) return table; // before the window
    }
    const signed = entry.dir === "up" ? entry.sats : -entry.sats;
    table[entry.postId] = (table[entry.postId] ?? 0) + signed;
    return table;
  }, {});
}
