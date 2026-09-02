/** The morning's vital list: the few things that must happen today, as ticks.
 *
 *  It is assembled rather than typed, because a list you have to remember to
 *  write is a list that will be missing the morning it matters. Three sources,
 *  in this order:
 *
 *    1. the edition's own `vitals` — what today specifically demands;
 *    2. every board card that is waiting on Henry (a `review` card whose phase
 *       opens `YOU:`), because that is precisely the set of things nobody else
 *       can clear;
 *    3. the standing daily two, press-ups and squats, which are on the list
 *       every day by construction and cannot be forgotten out of it.
 */

export type Vital = {
  id: string;
  label: string;
  /** A few words on why it is vital today. Optional; the label carries it. */
  note?: string;
  /** Where it came from, so the page can style a standing item differently. */
  source: "today" | "board" | "standing";
};

export type VitalSeed = { id?: string; label: string; note?: string };

/** Every day, without exception. Ordered heaviest last, the way a set is. */
export const STANDING_VITALS: readonly VitalSeed[] = [
  { id: "press-ups", label: "Press-ups" },
  { id: "squats", label: "Squats" },
];

/** A list this long stops being a list. The standing two are never dropped. */
export const MAX_VITALS = 8;

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";

/** The phase prefix the board uses for work that only Henry can clear. */
const WAITS_ON_HENRY = /^\s*YOU:\s*/;

export type VitalCard = { id?: string; title?: string; col?: string; phase?: string };

/** The named question a `YOU:` phase asks, without its prefix. */
export function questionFrom(phase: string | undefined): string | null {
  if (!phase || !WAITS_ON_HENRY.test(phase)) return null;
  const asked = phase.replace(WAITS_ON_HENRY, "").trim();
  return asked.length > 0 ? asked : null;
}

/** Build the day's vital list. Pure: the page passes in what it has loaded. */
export function vitalsFor({
  today = [],
  cards = [],
  standing = STANDING_VITALS,
  max = MAX_VITALS,
}: {
  today?: VitalSeed[];
  cards?: VitalCard[];
  standing?: readonly VitalSeed[];
  max?: number;
}): Vital[] {
  const seen = new Set<string>();
  const take = (seed: VitalSeed, source: Vital["source"]): Vital | null => {
    const id = seed.id ?? slug(seed.label);
    if (seen.has(id)) return null;
    seen.add(id);
    return { id, label: seed.label, ...(seed.note ? { note: seed.note } : {}), source };
  };

  const fromToday = today.map((s) => take(s, "today")).filter((v): v is Vital => v !== null);

  const fromBoard = cards
    .filter((c) => c.col === "review")
    .map((c) => {
      const question = questionFrom(c.phase);
      if (!question || !c.title) return null;
      return take({ id: c.id, label: c.title, note: question }, "board");
    })
    .filter((v): v is Vital => v !== null);

  const fromStanding = standing.map((s) => take(s, "standing")).filter((v): v is Vital => v !== null);

  // The standing two always survive the cap; the day's own items outrank the
  // board's, and the board's tail is what gets cut when the box is full.
  const room = Math.max(0, max - fromStanding.length);
  return [...fromToday, ...fromBoard].slice(0, room).concat(fromStanding);
}
