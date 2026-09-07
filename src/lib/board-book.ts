/** The Board as a book: the sheet's front page, then four pages that each
 *  start a page of print. To do and In progress carry every card of their
 *  column, newest first, the way the column pages do; The month and The
 *  year are the plans the board carries as `month` and `year`, grouped by
 *  week and by month.
 *
 *  Pure. The page loads the board and the day's report; nothing here reads
 *  a clock, a store or the page. The front page keeps its own rule for
 *  room; nothing after it is ever trimmed, and each page flows over as
 *  many pages of print as it needs.
 */
import { columnPage, type ColumnCardInput, type ColumnPageModel } from "./board-columns";
import {
  boardSheetModel,
  isIsoDate,
  minusDays,
  type BoardSheetModel,
  type SheetBoard,
  type SheetCard,
  type SheetReport,
} from "./board-sheet";

/** One line of a plan. `when` is a date "2026-09-09", a month "2026-10", or
 *  a short span in the author's own words. */
export type PlanItem = { when: string; label: string; done?: boolean };
export type BoardPlan = { title: string; note?: string; items: PlanItem[] };

export type BookBoard = {
  generated?: string;
  generatedAt?: string;
  cards: (SheetCard & ColumnCardInput)[];
  week?: SheetBoard["week"];
  month?: BoardPlan | null;
  year?: BoardPlan | null;
};

export type PlanLine = { when: string; label: string; done: boolean };
export type PlanGroup = { label: string; lines: PlanLine[] };
export type PlanPageModel = { title: string; note: string | null; groups: PlanGroup[] };

export type BookPage =
  | { id: "todo" | "inprogress"; kind: "cards"; title: string; empty: string; list: ColumnPageModel }
  | { id: "month" | "year"; kind: "plan"; title: string; empty: string; plan: PlanPageModel | null };

export type BoardBookModel = { front: BoardSheetModel; pages: BookPage[] };

export type Grouping = "week" | "month";

const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** The parts of a date, or of a month's first day, in the paper's English. */
function parts(iso: string): Record<string, string> {
  const day = new Date(`${MONTH.test(iso) ? `${iso}-01` : iso}T00:00:00Z`);
  const format = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return Object.fromEntries(format.formatToParts(day).map((p) => [p.type, p.value]));
}

/** "Wed 9 September". */
function shortDate(iso: string): string {
  const p = parts(iso);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "6 to 12 September", or "27 September to 3 October" across a month end. */
function weekLabel(sunday: string): string {
  const start = parts(sunday);
  const end = parts(minusDays(sunday, -6));
  return start.month === end.month
    ? `${start.day} to ${end.day} ${end.month}`
    : `${start.day} ${start.month} to ${end.day} ${end.month}`;
}

/** The real date or month a `when` opens with, or null for words. A span
 *  written "2026-09-14 to 2026-09-18" opens with its first date. */
function opening(when: string): { month: string; day: string | null } | null {
  const m = /^(\d{4}-(?:0[1-9]|1[0-2]))(?:-(\d{2}))?/.exec(when);
  if (!m) return null;
  const [, month, day] = m;
  if (day && !isIsoDate(`${month}-${day}`)) return null;
  return { month, day: day ?? null };
}

/** The Sunday the board's week begins on. */
function weekStart(iso: string): string {
  return minusDays(iso, new Date(`${iso}T00:00:00Z`).getUTCDay());
}

/** The `when` as the page prints it: a date as "Wed 9 September", a month
 *  as "October", and any other words as written, with the dates in them
 *  spelt the same way. */
export function whenLabel(when: string): string {
  return when
    .trim()
    .replace(/\d{4}-\d{2}(?:-\d{2})?/g, (iso) => (isIsoDate(iso) ? shortDate(iso) : MONTH.test(iso) ? parts(iso).month : iso));
}

/** The plan grouped for its page: by the week (Sunday to Saturday) of each
 *  dated item on the month, by the month on the year. A month-wide item
 *  heads its month either way; items in words make a group of their own,
 *  after the dated ones, in the order they were written. Within a group the
 *  lines run by date. Null when the board carries no such plan. */
export function planPageModel(plan: BoardPlan | null | undefined, by: Grouping): PlanPageModel | null {
  if (!plan) return null;
  const keyed = plan.items.map((item) => {
    const when = item.when.trim();
    const o = opening(when);
    const key = o === null ? when : o.day && by === "week" ? weekStart(`${o.month}-${o.day}`) : o.month;
    return { item, dated: o !== null, key, order: o === null ? "" : o.day ? `${o.month}-${o.day}` : o.month };
  });
  const groups = [...new Map(keyed.map((k) => [k.key, k])).values()]
    .sort((a, b) => (a.dated && b.dated ? a.key.localeCompare(b.key) : Number(b.dated) - Number(a.dated)))
    .map(({ key, dated }) => ({
      label: !dated ? key : MONTH.test(key) ? `${parts(key).month} ${parts(key).year}` : weekLabel(key),
      lines: keyed
        .filter((k) => k.key === key)
        .sort((a, b) => a.order.localeCompare(b.order))
        .map(({ item }) => ({ when: whenLabel(item.when), label: item.label, done: item.done === true })),
    }));
  return { title: plan.title, note: plan.note?.trim() || null, groups };
}

export function boardBookModel(board: BookBoard, report: SheetReport, date: string): BoardBookModel {
  return {
    front: boardSheetModel(board, report, date),
    pages: [
      { id: "todo", kind: "cards", title: "To do", empty: "Nothing to do.", list: columnPage(board, "todo", date) },
      { id: "inprogress", kind: "cards", title: "In progress", empty: "Nothing in hand.", list: columnPage(board, "inprogress", date) },
      { id: "month", kind: "plan", title: "The month", empty: "Not laid out yet.", plan: planPageModel(board.month, "week") },
      { id: "year", kind: "plan", title: "The year", empty: "Not laid out yet.", plan: planPageModel(board.year, "month") },
    ],
  };
}
