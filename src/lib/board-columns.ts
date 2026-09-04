/** The Board's column pages: one column of the kanban, every card in it, on
 *  as many pages of print as the column takes.
 *
 *  Pure. The page loads the board; this picks the column, orders it newest
 *  first, windows the done pile to thirty days unless the whole of it is
 *  asked for, and cuts each card's latest note to its first sentence. Nothing
 *  here reads a clock, a store or the page. No card is ever dropped for room:
 *  that is the sheet's rule, and these pages are its full lists.
 */
import type { Card } from "@/app/board/BoardClient";
import { APP_NAMES, firstSentence, minusDays, stampOf } from "./board-sheet";

export const COLUMNS = ["review", "inprogress", "todo", "backlog", "done"] as const;
export type ColumnId = (typeof COLUMNS)[number];

/** The standfirst each column page wears, in the sheet's own words. */
export const COLUMN_LABELS: Record<ColumnId, string> = {
  review: "Waiting on you",
  inprogress: "In hand",
  todo: "This week's pulls and ledgers",
  backlog: "Backlog",
  done: "Done",
};

export function isColumnId(name: string): name is ColumnId {
  return (COLUMNS as readonly string[]).includes(name);
}

export type ColumnCardInput = Pick<Card, "id" | "title" | "col"> &
  Partial<Pick<Card, "phase" | "apps" | "desc" | "movedAt" | "doneAt">>;
export type ColumnBoard = { generated?: string; generatedAt?: string; cards: ColumnCardInput[] };

export type ColumnCard = {
  id: string;
  title: string;
  phase: string;
  /** The apps by name; "All four" for a card on every app. */
  apps: string[];
  /** "moved 1 September 2026", or "done ..." on the done column; null when
   *  the card carries no date. */
  when: string | null;
  /** The first sentence of the latest dated note, never the whole description. */
  note: string;
};
/** The done pile is windowed to the thirty days ending on the date unless
 *  the whole of it is asked for; the four live columns are never windowed. */
export type ColumnWindow = { all: false; since: string } | { all: true };
export type ColumnPageModel = {
  column: ColumnId;
  label: string;
  date: string;
  /** "2026-09-04 10:09": when the board was published, as it stamps itself. */
  stamp: string | null;
  cards: ColumnCard[];
  /** The column's whole count, before any window. */
  total: number;
  window: ColumnWindow | null;
};

/** The thirty days ending on the date, counted the way the sheet counts its seven. */
export const DONE_WINDOW_DAYS = 30;

/** The opening of a dated note as the board writes it: the date, its time
 *  when it has one, the word "sweep" on a few July cards, and a separator,
 *  all of it in bold or not. The words after it are the note. */
const STAMP = /^(?:\*\*\s*)?\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?(?:\s+sweep)?\s*(?:[·:→—–-]\s*)?/;

/** The first sentence of the description's first paragraph, its latest dated
 *  note, with the stamp and the bold and code marks taken off. Never the
 *  whole description: a card's story stays on the board. */
export function latestNote(desc: string | undefined, max = 200): string {
  const paragraph = (desc ?? "").trim().split(/\n\s*\n/, 1)[0] ?? "";
  const words = paragraph.replace(STAMP, "").replace(/\*\*|`/g, "").trim();
  return firstSentence(words, max);
}

function appName(id: string): string {
  return id === "*" ? "All four" : (APP_NAMES[id] ?? id);
}

/** "1 September 2026", timezone-free, from the calendar day of a stamp. */
function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** The stamp a column orders by: when the card was moved, or for the done
 *  pile when it was done, with the move stamp standing in for a card done
 *  before doneAt existed. */
function stampFor(card: ColumnCardInput, column: ColumnId): string | undefined {
  return column === "done" ? (card.doneAt ?? card.movedAt) : card.movedAt;
}

type Dated = { card: ColumnCardInput; day: string | null; time: number | null };

function dated(card: ColumnCardInput, column: ColumnId): Dated {
  const stamp = stampFor(card, column);
  const time = Date.parse(stamp ?? "");
  return Number.isNaN(time) ? { card, day: null, time: null } : { card, day: (stamp ?? "").slice(0, 10), time };
}

/** Newest first; a card with no stamp goes last, in the board's own order. */
function newestFirst(a: Dated, b: Dated): number {
  if (a.time === null || b.time === null) return (a.time === null ? 1 : 0) - (b.time === null ? 1 : 0);
  return b.time - a.time;
}

function toCard(column: ColumnId, { card, day }: Dated): ColumnCard {
  return {
    id: card.id,
    title: card.title,
    phase: card.phase ?? "",
    apps: (card.apps ?? []).map(appName),
    when: day === null ? null : `${column === "done" ? "done" : "moved"} ${dayLabel(day)}`,
    note: latestNote(card.desc),
  };
}

export function columnPageModel(
  board: ColumnBoard,
  column: string,
  date: string,
  { all = false }: { all?: boolean } = {},
): ColumnPageModel | null {
  if (!isColumnId(column)) return null;
  const whole = board.cards.filter((c) => c.col === column).map((c) => dated(c, column));
  const window: ColumnWindow | null = column !== "done" ? null : all ? { all } : { all, since: minusDays(date, DONE_WINDOW_DAYS - 1) };
  const inWindow = (d: Dated): boolean =>
    window === null || window.all || (d.day !== null && d.day >= window.since && d.day <= date);
  return {
    column,
    label: COLUMN_LABELS[column],
    date,
    stamp: stampOf(board),
    cards: whole.filter(inWindow).sort(newestFirst).map((d) => toCard(column, d)),
    total: whole.length,
    window,
  };
}
