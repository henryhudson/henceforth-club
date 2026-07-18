// The commit beat — the batching half of the kudos gesture, as a pure fold.
// Rapid taps are one act of generosity: each tap grows the pending amount
// and pushes the beat's close out, and when the beat closes the whole
// amount commits as one request. Time is a parameter — the control feeds
// the clock in; nothing here reads it.

export type Beat = {
  /** Kudos tapped but not yet committed. */
  pending: number;
  /** When the beat closes if no further tap lands, in epoch milliseconds —
   * null at rest. */
  closesAt: number | null;
};

export const restingBeat: Beat = { pending: 0, closesAt: null };

/** One tap: the pending amount grows by one and the beat extends to
 * `now + beatMs` — the beat always closes relative to the LAST tap. */
export function tap(beat: Beat, now: number, beatMs: number): Beat {
  return { pending: beat.pending + 1, closesAt: now + beatMs };
}

/** What the clock commits at `now`: the whole pending amount once the beat
 * has closed (returning the beat to rest), nothing while it is still open
 * or at rest. */
export function commitDue(beat: Beat, now: number): { beat: Beat; commit: number } {
  if (beat.closesAt === null || now < beat.closesAt || beat.pending < 1) {
    return { beat, commit: 0 };
  }
  return { beat: restingBeat, commit: beat.pending };
}
