/** The Board as a book: the sheet's front page, then four pages that each
 *  start a page of print. To do carries every card in hand at its top and
 *  then every card to do, each group newest first, the way the column pages
 *  do (Henry, 2026-09-07: no page of its own for what is in progress; the
 *  to do page handles it). The day, the month
 *  and the year are grids of boxes for the pen: twenty-four hours, the
 *  month's days seven to a week, and twelve months; the plans the board
 *  carries as `week`, `month` and `year` are printed inside the boxes they
 *  fall on, and the boxes print empty when the board carries no plan.
 *
 *  Pure. The page loads the board and the day's report; nothing here reads
 *  a clock, a store or the page. The front page keeps its own rule for
 *  room; nothing after it is ever trimmed, and the card pages flow over as
 *  many pages of print as they need.
 */
import { columnPage, type ColumnCard, type ColumnCardInput, type ColumnPageModel } from "./board-columns";
import {
  boardSheetModel,
  isIsoDate,
  minusDays,
  weekRows,
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

/** A plan's line as a box prints it: the when only where it says more than
 *  the box does (a span on a day, a date on a month, words anywhere). */
export type PlanLine = { when: string | null; label: string; done: boolean };
export type Tick = { label: string; done: boolean };

export type GridDay = { date: string; day: number; inMonth: boolean; items: PlanLine[] };
export type GridMonth = { month: string; label: string; items: PlanLine[] };

export type DayPageModel = { date: string; heading: string; tasks: Tick[]; hours: string[] };
/** `others` are the plan's lines that fall on no box: a month-wide item or
 *  words on the month, words or a month beyond the twelve on the year.
 *  `laidOut` is false when the board carries no such plan; the boxes print
 *  empty either way. */
export type MonthPageModel = { heading: string; note: string | null; laidOut: boolean; weeks: GridDay[][]; others: PlanLine[] };
export type YearPageModel = { heading: string; note: string | null; laidOut: boolean; months: GridMonth[]; others: PlanLine[] };

/** The cards page: `inHand` is the in progress column, printed at the top
 *  under its own label and left out when empty; `list` is the to do column. */
export type BookPage =
  | { id: "todo"; kind: "cards"; title: string; empty: string; inHand: ColumnCard[]; list: ColumnPageModel }
  | { id: "day"; kind: "day"; title: string; day: DayPageModel }
  | { id: "month"; kind: "month"; title: string; empty: string; month: MonthPageModel }
  | { id: "year"; kind: "year"; title: string; empty: string; year: YearPageModel };

export type BoardBookModel = { front: BoardSheetModel; pages: BookPage[] };

const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** The parts of a date, or of a month's first day, in the paper's English. */
function parts(iso: string): Record<string, string> {
  const day = new Date(`${MONTH.test(iso) ? `${iso}-01` : iso}T00:00:00Z`);
  const format = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
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
  return `${p.weekday.slice(0, 3)} ${p.day} ${p.month}`;
}

/** "September 2026". */
function monthLabel(month: string): string {
  const p = parts(month);
  return `${p.month} ${p.year}`;
}

/** The month `n` months on from `month`, as "2027-01". */
function plusMonths(month: string, n: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)).toISOString().slice(0, 7);
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

/** The `when` as the page prints it: a date as "Wed 9 September", a month
 *  as "October", and any other words as written, with the dates in them
 *  spelt the same way. */
export function whenLabel(when: string): string {
  return when
    .trim()
    .replace(/\d{4}-\d{2}(?:-\d{2})?/g, (iso) => (isIsoDate(iso) ? shortDate(iso) : MONTH.test(iso) ? parts(iso).month : iso));
}

/** The item as a box keyed `key` prints it: its when only when it says more
 *  than the box already does. */
function lineIn(item: PlanItem, key: string | null): PlanLine {
  const when = item.when.trim();
  return { when: when === key ? null : whenLabel(when), label: item.label, done: item.done === true };
}

/** The date an item falls on, or the month, or null for words. */
function dateKey(item: PlanItem): string | null {
  const o = opening(item.when.trim());
  return o && o.day ? `${o.month}-${o.day}` : null;
}
function monthKey(item: PlanItem): string | null {
  return opening(item.when.trim())?.month ?? null;
}

/** The twenty-four hours of a day, "00" to "23". */
export function hourGrid(): string[] {
  return Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
}

/** The month as a calendar of weeks, Monday to Sunday, from the Monday on or
 *  before the first to the Sunday on or after the last; the days of the
 *  months either side are there for the shape and marked not in the month.
 *  Each day carries the items that open on it, in the order written. */
export function monthGrid(items: PlanItem[], yearMonth: string): GridDay[][] {
  const first = `${yearMonth}-01`;
  const start = minusDays(first, (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7);
  const last = minusDays(`${plusMonths(yearMonth, 1)}-01`, 1);
  const days: GridDay[] = [];
  for (let date = start; days.length % 7 !== 0 || date <= last; date = minusDays(date, -1)) {
    days.push({
      date,
      day: Number(date.slice(8, 10)),
      inMonth: date.startsWith(yearMonth),
      items: items.filter((item) => dateKey(item) === date).map((item) => lineIn(item, date)),
    });
  }
  return Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));
}

/** Twelve months from `firstMonth`, each carrying the items that open in it,
 *  dated or month-wide, in the order written. */
export function yearGrid(items: PlanItem[], firstMonth: string): GridMonth[] {
  return Array.from({ length: 12 }, (_, n) => {
    const month = plusMonths(firstMonth, n);
    return { month, label: monthLabel(month), items: items.filter((item) => monthKey(item) === month).map((item) => lineIn(item, month)) };
  });
}

/** The month the plan opens on: its first item's, or the date's when the
 *  plan is absent or opens with words. */
function firstMonthOf(plan: BoardPlan | null | undefined, date: string): string {
  const first = plan?.items[0];
  return (first && monthKey(first)) ?? date.slice(0, 7);
}

export function dayPageModel(week: SheetBoard["week"], date: string): DayPageModel {
  const p = parts(date);
  return {
    date,
    heading: `${p.weekday} ${p.day} ${p.month} ${p.year}`,
    tasks: weekRows(week?.weekPlan).find((row) => row.date === date)?.tasks ?? [],
    hours: hourGrid(),
  };
}

export function monthPageModel(plan: BoardPlan | null | undefined, date: string): MonthPageModel {
  const month = firstMonthOf(plan, date);
  const items = plan?.items ?? [];
  const weeks = monthGrid(items, month);
  const onGrid = new Set(weeks.flat().map((d) => d.date));
  return {
    heading: monthLabel(month),
    note: plan?.note?.trim() || null,
    laidOut: !!plan,
    weeks,
    others: items.filter((item) => !onGrid.has(dateKey(item) ?? "")).map((item) => lineIn(item, null)),
  };
}

export function yearPageModel(plan: BoardPlan | null | undefined, date: string): YearPageModel {
  const first = firstMonthOf(plan, date);
  const items = plan?.items ?? [];
  const months = yearGrid(items, first);
  const onGrid = new Set(months.map((m) => m.month));
  return {
    heading: `${monthLabel(first)} to ${monthLabel(plusMonths(first, 11))}`,
    note: plan?.note?.trim() || null,
    laidOut: !!plan,
    months,
    others: items.filter((item) => !onGrid.has(monthKey(item) ?? "")).map((item) => lineIn(item, null)),
  };
}

export function boardBookModel(board: BookBoard, report: SheetReport, date: string): BoardBookModel {
  return {
    front: boardSheetModel(board, report, date),
    pages: [
      {
        id: "todo",
        kind: "cards",
        title: "To do",
        empty: "Nothing to do.",
        inHand: columnPage(board, "inprogress", date).cards,
        list: columnPage(board, "todo", date),
      },
      { id: "day", kind: "day", title: "The day", day: dayPageModel(board.week, date) },
      { id: "month", kind: "month", title: "The month", empty: "Not laid out yet.", month: monthPageModel(board.month, date) },
      { id: "year", kind: "year", title: "The year", empty: "Not laid out yet.", year: yearPageModel(board.year, date) },
    ],
  };
}
