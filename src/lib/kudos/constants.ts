// Tuning constants for the folklore kudos economy — one module, so a tuning
// change is one edit and one replay of the fold. Kudos amounts are integer
// kudos units everywhere; pounds and pence appear only at the funding and
// settlement edges.

/** One kudos is a tenth of a UK penny. */
export const KUDOS_PENCE = 0.1;

/** The profile-opening leg that returns to the buyer as their kudos float
 * (2,000 kudos at KUDOS_PENCE each). */
export const FLOAT_POUNDS = 2;

/** Every text starts here; a rating is a fold over the duel ledger, never a
 * stored number. */
export const ELO_START = 1500;

/** K while a text has fewer than PROVISIONAL_DUELS duels — provisional
 * ratings find their level fast. */
export const K_PROVISIONAL = 40;

/** K from PROVISIONAL_DUELS on — the top stays stable. */
export const K_ESTABLISHED = 16;

/** Duel count at which a text stops being provisional and drops the
 * unranked badge. */
export const PROVISIONAL_DUELS = 20;

/** An author's rating is the mean of their top texts — rewards peaks, not
 * flooding. */
export const AUTHOR_TOP_N = 5;

/** The dealer's pair mix; the fractions sum to one. */
export const DEAL_MIX = {
  ratingAdjacent: 0.6,
  provisionalVersusEstablished: 0.2,
  tipPriority: 0.15,
  uniformRandom: 0.05,
} as const;

/** Dealt-pair tokens are single use and expire after this many minutes. */
export const PAIR_TOKEN_MINUTES = 10;

/** Per-float daily duel cap — bounds what self-kudos can do to the table. */
export const DAILY_DUEL_CAP = 200;

/** Settlement dust floor in satoshis; sub-dust accruals roll to the next
 * sweep. */
export const SETTLE_DUST_SATS = 546;

/** A tip's dealer-priority bump halves every this many days — tips buy a
 * burst of duel exposure, not a permanent seat at the table. */
export const TIP_PRIORITY_HALF_LIFE_DAYS = 7;

/** A decayed priority below one kudos reads as exactly zero, so an old tip
 * eventually leaves the dealer's tipped pool instead of haunting it as an
 * ever-smaller fraction. */
export const TIP_PRIORITY_FLOOR = 1;

// MARGIN_POUNDS, TAX_RESERVE_RATE, STRIPE_FEE_RATE and STRIPE_FEE_FIXED_PENCE
// are set with the accountant's numbers in the taxes session on 2026-07-19
// and land here with the pricing module (task 13).
