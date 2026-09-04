/** The Board: the working set of the kanban, selected for one printed sheet.
 *
 *  Pure. The page loads the board and the day's report; this decides what the
 *  sheet carries and in what order, and nothing here reads a clock, a store or
 *  the page. The done pile never comes along: a card line is its title and its
 *  one-line phase, never the long description.
 */
import type { Card } from "@/app/board/BoardClient";
import type { AppStore, Decision, PlanDay } from "./board-data";

export type SheetCard = Pick<Card, "id" | "title" | "col"> & Partial<Pick<Card, "phase" | "doneAt">>;
export type SheetBoard = {
  generated?: string;
  generatedAt?: string;
  cards: SheetCard[];
  week?: { weekPlan: PlanDay[] } | null;
};
export type SheetReport = { decisions?: Decision[]; appStore?: AppStore } | null | undefined;

export type CardLine = {
  id: string;
  title: string;
  phase: string;
  /** The day's report proposes something for this card. */
  decision?: { proposal: string; why: string };
};
export type LedgerRow = {
  app: string;
  status: string;
  version: string;
  daysSince: number | null;
  ready: boolean;
  note: string;
};
export type Ledger =
  | { source: "storefront"; rows: LedgerRow[] }
  | { source: "cards"; rows: { id: string; title: string; phase: string }[] };
export type WeekRow = { date: string; label: string; tasks: { label: string; done: boolean }[] };
export type BoardSheetModel = {
  date: string;
  /** "2026-09-04 10:09": when the board was published, as it stamps itself. */
  stamp: string | null;
  counts: { total: number; review: number; inprogress: number; todo: number; backlog: number; done: number };
  waiting: CardLine[];
  inHand: CardLine[];
  pulls: CardLine[];
  ledger: Ledger;
  week: WeekRow[];
  rhythms: CardLine[];
  doneThisWeek: string[];
  /** The done strip was dropped to make the page. */
  trimmed: boolean;
};

/** The four standing cards that carry the ship state, in the order the sheet
 *  prints them. They live in the todo column and never count as pulls. */
export const LEDGER_CARDS = ["cadence-appstore", "henceforth-release-4-45", "hansard-release-v1", "deck-update"] as const;

export const APP_NAMES: Record<string, string> = {
  deck: "Deck of Cards",
  henceforth: "Henceforth",
  hansard: "The Hansard",
  site: "henceforth.club",
};

/** A standing phase opens with the word, then a colon or a middle dot. Both
 *  spellings are on the board. */
const STANDING = /^\s*STANDING\b\s*[:·]?\s*/;

/** The phase after its STANDING prefix, or null when the phase is not standing. */
export function standingRest(phase: string | undefined): string | null {
  if (!phase || !STANDING.test(phase)) return null;
  return phase.replace(STANDING, "").trim();
}

/** The first sentence, or the whole when it has no full stop, capped. */
export function firstSentence(text: string, max = 110): string {
  const end = /[.!?](?=\s|$)/.exec(text);
  const cut = (end ? text.slice(0, end.index + 1) : text).trim();
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut;
}

/** A real calendar date, not merely the shape of one: the done windows
 *  count days from it. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

const DAY_MS = 86_400_000;

/** `iso` less `days`, on the calendar, timezone-free. */
export function minusDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

/** Older reports spell readiness as a word; newer ones as a boolean. */
function isReady(value: unknown): boolean {
  return value === true || (typeof value === "string" && /^(true|yes|ready)\b/i.test(value));
}

function line(card: SheetCard, phase = card.phase ?? ""): CardLine {
  return { id: card.id, title: card.title, phase };
}

function weekRows(plan: PlanDay[] | null | undefined): WeekRow[] {
  return (plan ?? []).map((day) => ({
    date: day.date,
    label: `${day.weekday.slice(0, 3)} ${parseInt(day.date.slice(8, 10), 10)}`,
    tasks: (day.tasks ?? []).map((t) =>
      typeof t === "string" ? { label: t, done: false } : { label: t.label, done: !!t.done },
    ),
  }));
}

/** "2026-09-04 10:09": when the board was published, as it stamps itself. */
export function stampOf(board: Pick<SheetBoard, "generated" | "generatedAt">): string | null {
  const m = board.generated?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;
  const at = board.generatedAt?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return at ? `${at[1]} ${at[2]}` : null;
}

function doneTime(card: SheetCard): number {
  const t = Date.parse(card.doneAt ?? "");
  return Number.isNaN(t) ? 0 : t;
}

export function boardSheetModel(board: SheetBoard, report: SheetReport, date: string): BoardSheetModel {
  const cards = board.cards;
  const inCol = (col: string) => cards.filter((c) => c.col === col);
  const decisions = report?.decisions ?? [];
  const withDecision = (card: SheetCard): CardLine => {
    const d = decisions.find((x) => x.card === card.id);
    return d ? { ...line(card), decision: { proposal: d.proposal, why: d.why } } : line(card);
  };

  const ledgerIds = new Set<string>(LEDGER_CARDS);
  const todo = inCol("todo");
  const pulls = todo.filter((c) => standingRest(c.phase) === null).map((c) => line(c));
  // A standing card that is not one of the four ship cards is a rhythm
  // whichever of the two waiting columns it sits in.
  const rhythms = [...inCol("backlog"), ...todo]
    .filter((c) => !ledgerIds.has(c.id))
    .flatMap((c) => {
      const rest = standingRest(c.phase);
      return rest === null ? [] : [line(c, rest)];
    });

  const storefront = report?.appStore?.apps ?? [];
  const ledger: Ledger =
    storefront.length > 0
      ? {
          source: "storefront",
          rows: storefront.map((a) => ({
            app: APP_NAMES[a.app] ?? a.app,
            status: a.status,
            version: a.version,
            daysSince: a.daysSince,
            ready: isReady(a.readyToShip),
            note: firstSentence(a.blocker ?? ""),
          })),
        }
      : {
          source: "cards",
          rows: LEDGER_CARDS.flatMap((id) => {
            const card = cards.find((c) => c.id === id);
            return card ? [{ id, title: card.title, phase: standingRest(card.phase) ?? card.phase ?? "" }] : [];
          }),
        };

  const since = minusDays(date, 6);
  const doneThisWeek = inCol("done")
    .filter((c) => {
      const day = (c.doneAt ?? "").slice(0, 10);
      return day >= since && day <= date;
    })
    .sort((a, b) => doneTime(b) - doneTime(a))
    .map((c) => c.title);

  return {
    date,
    stamp: stampOf(board),
    counts: {
      total: cards.length,
      review: inCol("review").length,
      inprogress: inCol("inprogress").length,
      todo: todo.length,
      backlog: inCol("backlog").length,
      done: inCol("done").length,
    },
    waiting: inCol("review").map(withDecision),
    inHand: inCol("inprogress").map((c) => line(c)),
    pulls,
    ledger,
    week: weekRows(board.week?.weekPlan),
    rhythms,
    doneThisWeek,
    trimmed: false,
  };
}

/** When the working set outgrows the page, the done strip goes first, and
 *  whole. Returns null when there is nothing left to trim: the render then
 *  refuses the page the way it refuses a clipped daily. */
export function trim(model: BoardSheetModel): BoardSheetModel | null {
  if (model.doneThisWeek.length === 0) return null;
  return { ...model, doneThisWeek: [], trimmed: true };
}
