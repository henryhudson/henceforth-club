// Pure Elo for the folklore duels. The append-only duel ledger is the only
// truth; a rating table is a deterministic replay of that ledger, so a
// correction (a gamed batch struck out, a refunded float) is a replay, never
// a patch to a cached number. Nothing here touches Redis or the clock — the
// same shape as xScore.ts: entries in, a table out.

import {
  AUTHOR_TOP_N,
  ELO_START,
  K_ESTABLISHED,
  K_PROVISIONAL,
  PROVISIONAL_DUELS,
} from "./constants";

/** One resolved duel, exactly as it sits in the `kudos:duels` ledger.
 * No giver identity — privacy is structural, not policy. */
export type DuelEntry = {
  /** Monotone position in the append-only ledger — the fold's replay order. */
  seq: number;
  duelId: string;
  winnerPostId: string;
  loserPostId: string;
  /** The UTC day the duel resolved, as YYYY-MM-DD. Carried for display and
   * corrections; the fold itself has no clock. */
  day: string;
};

export type Rating = {
  rating: number;
  /** Duels folded so far — drives the K schedule and the unranked badge. */
  duels: number;
};

export type RatingTable = Record<string, Rating>;

/** A cached fold as of `seq` — a cache, never a source of truth. */
export type Checkpoint = {
  seq: number;
  table: RatingTable;
};

/** A text the ledger has never seen sits at the start, undueled. */
export function ratingOf(table: RatingTable, postId: string): Rating {
  return table[postId] ?? { rating: ELO_START, duels: 0 };
}

/** The probability the first rating beats the second:
 * `1 / (1 + 10^((opponent − rating) / 400))`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/** The K schedule: provisional texts move fast, established ones stay put. */
export function kFor(duels: number): number {
  return duels < PROVISIONAL_DUELS ? K_PROVISIONAL : K_ESTABLISHED;
}

/**
 * One duel folded into the table: the winner takes `K · (1 − E)`, the loser
 * gives the mirror, each side at its own K. A self-duel folds as a no-op —
 * the dealer never deals one, and a hand-written entry must not corrupt the
 * table. Pure: the given table is never mutated.
 */
export function applyDuel(table: RatingTable, entry: DuelEntry): RatingTable {
  if (entry.winnerPostId === entry.loserPostId) return table;
  const winner = ratingOf(table, entry.winnerPostId);
  const loser = ratingOf(table, entry.loserPostId);
  const upset = 1 - expectedScore(winner.rating, loser.rating);
  return {
    ...table,
    [entry.winnerPostId]: {
      rating: winner.rating + kFor(winner.duels) * upset,
      duels: winner.duels + 1,
    },
    [entry.loserPostId]: {
      rating: loser.rating - kFor(loser.duels) * upset,
      duels: loser.duels + 1,
    },
  };
}

/**
 * The pure fold: duels in ledger order in, a rating table out. Elo does not
 * commute — the ledger's order is the order. With a checkpoint, entries at
 * or before its sequence are skipped, so resuming from a checkpoint equals
 * folding the whole ledger from nothing, whether given the tail or the whole
 * ledger. Total: any entries and any checkpoint fold to a table.
 */
export function foldDuels(
  entries: readonly DuelEntry[],
  from?: Checkpoint,
): RatingTable {
  return entries.reduce(
    (table, entry) =>
      from !== undefined && entry.seq <= from.seq ? table : applyDuel(table, entry),
    from?.table ?? {},
  );
}

/**
 * Author ratings — each author's is the mean of their top AUTHOR_TOP_N rated
 * texts: rewards peaks, not flooding. Only texts the ledger has seen carry a
 * rating; an author with none is absent from the result, not defaulted.
 */
export function authorRatings(
  table: RatingTable,
  postsByAuthor: Record<string, readonly string[]>,
): Record<string, number> {
  return Object.entries(postsByAuthor).reduce<Record<string, number>>(
    (out, [author, postIds]) => {
      const top = postIds
        .flatMap((id) => (table[id] === undefined ? [] : [table[id].rating]))
        .sort((a, b) => b - a)
        .slice(0, AUTHOR_TOP_N);
      if (top.length > 0) {
        out[author] = top.reduce((sum, rating) => sum + rating, 0) / top.length;
      }
      return out;
    },
    {},
  );
}
