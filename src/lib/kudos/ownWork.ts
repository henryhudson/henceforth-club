// The self-kudos refusal — one predicate, shared by every route that accepts
// kudos. Paying yourself serves no honest purpose: it mints nothing but
// chart position, and with the Top chart's thread roll-up it would let an
// author buy their root's rank through their own continuation posts. One
// check covers both, because an archive holds only its own account's posts:
// a continuation post's author IS its thread root's author, so
// payer-matches-author refuses the roll-up-gaming case too.

/** The friendly line the refusal answers with — one voice on every route. */
export const OWN_WORK_LINE =
  "Your own text — kudos are for other people's work.";

/** True when a kudos would land on the giver's own work: the payer's
 * profile and the receiving text's author are the same handle.
 * Case-insensitive, as X handles are. */
export function isOwnWork(profile: string, author: string): boolean {
  return profile.toLowerCase() === author.toLowerCase();
}
