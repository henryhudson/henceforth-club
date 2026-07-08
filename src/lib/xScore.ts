// Pure scoring for the paid-vote ranking. A profile's votes live in an
// append-only ledger; a post's ranking score is a fold over that ledger with
// each vote's satoshis decayed by age. Nothing here touches Redis or the
// clock — the ledger and the as-of day come in, a score table comes out — so
// any correction (a double-spent funding transaction, a tuning change) is an
// exact replay of the fold, never a patch to a cached number. The satoshis
// themselves never decay — money paid is money kept; only ranking influence
// fades.

/** The one ranking-decay tuning constant: a vote's ranking weight halves
 * every thirty days. Lives only here. */
export const SCORE_HALF_LIFE_DAYS = 30;

export type VoteDirection = "up" | "down";

/** One verified vote, exactly as it sits in the `x:ledger:<handle>` list.
 * Append-only: entries are only ever added (or, on a correction such as a
 * double-spent funding transaction, removed and the fold replayed). */
export type VoteLedgerEntry = {
  /** The funding transaction id — the payment IS the vote, and counts once. */
  txid: string;
  postId: string;
  dir: VoteDirection;
  /** Satoshis paid: the vote's full, undecayed weight. */
  sats: number;
  /** The UTC day the vote was verified, as YYYY-MM-DD (`dateKey` format) —
   * the day-bucket granularity the decay is computed at. */
  day: string;
};

/** One `x:score:<handle>` sorted-set entry, in the shape Upstash `zadd` takes. */
export type ScoreEntry = { member: string; score: number };

const MS_PER_DAY = 86_400_000;

/** Ranking weight of a vote `daysAgo` days old: `2^(−daysAgo / halfLife)`.
 * Clamped so a vote never counts more than fully — a day in the future of
 * the fold (clock skew between writers, or a replay as of an earlier day)
 * weighs 1, not above it. */
export function decayWeight(daysAgo: number): number {
  return 2 ** (-Math.max(daysAgo, 0) / SCORE_HALF_LIFE_DAYS);
}

/** Whole days between a ledger day and the as-of day; NaN when either day
 * string is unreadable. Date-only strings parse as UTC midnight, so valid
 * inputs always land on an integer. */
function daysBetween(day: string, asOfDay: string): number {
  return (Date.parse(asOfDay) - Date.parse(day)) / MS_PER_DAY;
}

/**
 * The pure fold: an append-only ledger in, a score table out —
 * `score(post) = Σ votes (±sats) × 2^(−daysAgo / halfLife)` as of `asOfDay`.
 * An entry whose day can't be read contributes nothing, rather than turning
 * the whole table to NaN. Total: any ledger and any as-of day fold to a table.
 */
export function foldScores(
  ledger: readonly VoteLedgerEntry[],
  asOfDay: string,
): Record<string, number> {
  return ledger.reduce<Record<string, number>>((table, entry) => {
    const age = daysBetween(entry.day, asOfDay);
    if (Number.isNaN(age)) return table;
    const signed = entry.dir === "up" ? entry.sats : -entry.sats;
    table[entry.postId] = (table[entry.postId] ?? 0) + signed * decayWeight(age);
    return table;
  }, {});
}

/** The `x:score:<handle>` sorted-set cache, derived from the fold: one entry
 * per voted post. The cache is only ever this function's output — rebuilding
 * it is a replay of the ledger, never a patch. */
export function scoreEntries(
  ledger: readonly VoteLedgerEntry[],
  asOfDay: string,
): ScoreEntry[] {
  return Object.entries(foldScores(ledger, asOfDay)).map(([postId, score]) => ({
    member: postId,
    score,
  }));
}
