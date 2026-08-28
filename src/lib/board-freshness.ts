/**
 * How old is the board we are actually serving?
 *
 * In production the key-value store is the only source — `content/board` is
 * gitignored and never deployed — so when the store holds stale data there is
 * no fresher copy to prefer instead. Freshness there cannot be chosen, only
 * declared. This module supplies the declaration.
 *
 * Written after 24-28 August 2026, when the store went four days behind and the
 * board reported nothing unusual, because a board with an old timestamp and a
 * board with a current one render identically.
 */

export type BoardStamp = { generated?: string; generatedAt?: string };

/**
 * `generatedAt` is machine-readable and carries an offset, so it is preferred.
 * `generated` is prose the viewer prints verbatim ("2026-08-28 08:44 · nine
 * findings confirmed…"); its first sixteen characters are a stable local-time
 * stamp written by the morning routine, but they carry NO timezone. Parsing
 * them can therefore be out by the authoring machine's offset — immaterial
 * against a threshold measured in days, and the reason `generatedAt` exists.
 */
export function boardGeneratedAt(board: BoardStamp | null | undefined): Date | null {
  if (!board) return null;
  if (board.generatedAt) {
    const exact = new Date(board.generatedAt);
    if (!Number.isNaN(exact.getTime())) return exact;
  }
  const m = board.generated?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (!m) return null;
  const approx = new Date(`${m[1]}T${m[2]}:00`);
  return Number.isNaN(approx.getTime()) ? null : approx;
}

export type Freshness = {
  /** Human phrase for the age, e.g. "4 days old". */
  label: string;
  ageHours: number | null;
  /** True when the board is older than the threshold, or its age is unknowable. */
  stale: boolean;
  /** True when no timestamp could be read at all. */
  unknown: boolean;
};

const HOUR = 3_600_000;

function phrase(ageHours: number): string {
  if (ageHours < 1) return "less than an hour old";
  if (ageHours < 24) {
    const h = Math.floor(ageHours);
    return h === 1 ? "1 hour old" : `${h} hours old`;
  }
  const d = Math.floor(ageHours / 24);
  return d === 1 ? "1 day old" : `${d} days old`;
}

/**
 * An unreadable timestamp counts as stale. Failing closed is deliberate: the
 * whole point is that a board whose age cannot be established must not look
 * the same as one known to be current.
 */
export function describeFreshness(
  at: Date | null,
  now: Date,
  staleAfterHours = 24,
): Freshness {
  if (!at) return { label: "age unknown", ageHours: null, stale: true, unknown: true };
  const ageHours = (now.getTime() - at.getTime()) / HOUR;
  if (ageHours < 0) {
    // Clock skew between the authoring machine and the server. Not stale.
    return { label: "just now", ageHours: 0, stale: false, unknown: false };
  }
  return {
    label: phrase(ageHours),
    ageHours,
    stale: ageHours >= staleAfterHours,
    unknown: false,
  };
}
