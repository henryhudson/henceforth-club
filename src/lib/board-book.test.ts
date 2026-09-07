import { describe, expect, it } from "vitest";
import {
  boardBookModel,
  dayPageModel,
  hourGrid,
  monthGrid,
  monthPageModel,
  whenLabel,
  yearGrid,
  yearPageModel,
  type BoardPlan,
  type BookBoard,
  type PlanItem,
} from "./board-book";
import { columnPage } from "./board-columns";
import { boardSheetModel, type SheetReport } from "./board-sheet";

const DATE = "2026-09-07";

const month: BoardPlan = {
  title: "September 2026",
  note: "  Drafted on 7 September. Edit freely.  ",
  items: [
    { when: "2026-09-09", label: "Ship day: Hansard 1.11 and Henceforth 4.55." },
    { when: "2026-09-07", label: "The reach plan's first monthly verdict.", done: false },
    { when: "2026-09-13", label: "Episode sixteen." },
    { when: "2026-10", label: "The folklore door opens." },
    { when: "Later", label: "The Today calendar tab decided." },
    { when: "2026-09-30", label: "The month's last ship day." },
    { when: "2026-09-02", label: "Ship day: Henceforth 4.54 shipped.", done: true },
    { when: "2026-09-14 to 2026-09-18", label: "The sitting." },
    { when: "2026-09-27", label: "Episode eighteen." },
  ],
};

const year: BoardPlan = {
  title: "The year from September 2026",
  items: [
    { when: "2026-09", label: "Hansard 1.11 makes the Latest tab the front door." },
    { when: "2026-09-11", label: "File the confirmation statement.", done: true },
    { when: "2026-10", label: "The reach plan's second monthly verdict." },
    { when: "2027-01", label: "The live-coins wallet built." },
    { when: "2027-08", label: "The accounts filed on time." },
    { when: "2027-09", label: "A year on: the second run." },
    { when: "Some day", label: "The Mac app better than the iOS app." },
  ],
};

const board: BookBoard = {
  generated: "2026-09-07 09:55 · Monday: the month and year plans seeded",
  cards: [
    { id: "r1", col: "review", title: "File the confirmation statement", phase: "YOU: did the identity check happen?" },
    { id: "t-older", col: "todo", apps: ["deck"], title: "Deck convert", phase: "PULL: Tuesday", movedAt: "2026-09-01T09:00:00+01:00", desc: "2026-09-01 · The sitting is booked. More." },
    { id: "t-newer", col: "todo", apps: ["hansard"], title: "Two Dependabot alerts", phase: "PULL this week", movedAt: "2026-09-07T09:20:00+01:00" },
    { id: "cadence-appstore", col: "todo", apps: ["*"], title: "App Store cadence", phase: "STANDING: both payloads staged", movedAt: "2026-09-04T10:09:22+01:00" },
    { id: "parked", col: "todo", apps: ["site"], title: "A parked card", phase: "PARKED: until October" },
    { id: "d1", col: "done", title: "Done this morning", doneAt: "2026-09-07T08:00:00+01:00" },
  ],
  week: {
    weekPlan: [
      { date: "2026-09-06", weekday: "Sun", isReviewDay: false, tasks: ["Lay out the week"] },
      {
        date: "2026-09-07",
        weekday: "Mon",
        isReviewDay: false,
        tasks: [{ label: "Cut episode fifteen.", done: true }, { label: "Press the 1.10 release.", done: false }, "Post the film."],
      },
    ],
  },
  month,
  year,
};

const report: SheetReport = { decisions: [{ card: "r1", proposal: "today", why: "Done, or re-booked." }] };

const boxes = (weeks: ReturnType<typeof monthGrid>) => weeks.flat();

describe("the book's pages", () => {
  const book = boardBookModel(board, report, DATE);

  it("runs to do, the day, the month, the year, in that order, each named for its running foot, and no page for what is in progress", () => {
    expect(book.pages.map((p) => [p.id, p.kind, p.title])).toEqual([
      ["todo", "cards", "To do"],
      ["day", "day", "The day"],
      ["month", "month", "The month"],
      ["year", "year", "The year"],
    ]);
  });

  it("keeps the front page exactly as the sheet makes it", () => {
    expect(book.front).toEqual(boardSheetModel(board, report, DATE));
    expect(book.front.waiting[0].decision).toEqual({ proposal: "today", why: "Done, or re-booked." });
  });

  it("carries every card of the todo column, the parked ones too, newest first, the way the column page does", () => {
    const todo = book.pages[0];
    if (todo.kind !== "cards") throw new Error("the first page is the cards to do");
    expect(todo.list).toEqual(columnPage(board, "todo", DATE));
    expect(todo.list.cards.map((c) => c.id)).toEqual(["t-newer", "cadence-appstore", "t-older", "parked"]);
    expect(todo.list.cards[2].note).toBe("The sitting is booked.");
    expect(todo.empty).toBe("Nothing to do.");
  });

  it("carries the cards in hand at the top of the to do page, newest first, and none when the in progress column is empty", () => {
    const todo = book.pages[0];
    if (todo.kind !== "cards") throw new Error("the first page is the cards to do");
    expect(todo.inHand).toEqual([]);

    const busy: BookBoard = {
      ...board,
      cards: [
        ...board.cards,
        { id: "h-older", col: "inprogress", apps: ["henceforth"], title: "Episode sixteen", phase: "CUT: Thursday", movedAt: "2026-09-05T09:00:00+01:00" },
        { id: "h-newer", col: "inprogress", apps: ["hansard"], title: "The 1.10 press", movedAt: "2026-09-07T08:30:00+01:00", desc: "2026-09-07 · Script staged. More." },
      ],
    };
    const page = boardBookModel(busy, report, DATE).pages[0];
    if (page.kind !== "cards") throw new Error("the first page is the cards to do");
    expect(page.inHand).toEqual(columnPage(busy, "inprogress", DATE).cards);
    expect(page.inHand.map((c) => c.id)).toEqual(["h-newer", "h-older"]);
    expect(page.inHand[0].note).toBe("Script staged.");
    expect(page.list.cards.map((c) => c.id)).toEqual(["t-newer", "cadence-appstore", "t-older", "parked"]);
    expect(boardBookModel(busy, report, DATE).pages.map((p) => p.id)).toEqual(["todo", "day", "month", "year"]);
  });

  it("carries the day, the month and the year as grids with the plans' words, and the not-laid-out line for the plans the board lacks", () => {
    const [, d, m, y] = book.pages;
    if (d.kind !== "day" || m.kind !== "month" || y.kind !== "year") throw new Error("the last three pages are the grids");
    expect(d.day.heading).toBe("Monday 7 September 2026");
    expect(m.month.heading).toBe("September 2026");
    expect(m.month.note).toBe("Drafted on 7 September. Edit freely.");
    expect(m.month.laidOut).toBe(true);
    expect(y.year.heading).toBe("September 2026 to August 2027");
    expect(y.year.note).toBeNull();
    expect(y.year.laidOut).toBe(true);

    const bare = boardBookModel({ ...board, week: undefined, month: undefined, year: null }, null, DATE);
    const [, bd, bm, by] = bare.pages;
    if (bd.kind !== "day" || bm.kind !== "month" || by.kind !== "year") throw new Error("the last three pages are the grids");
    expect(bd.day.tasks).toEqual([]);
    expect(bd.day.hours).toHaveLength(24);
    expect(bm.empty).toBe("Not laid out yet.");
    expect(bm.month.laidOut).toBe(false);
    expect(bm.month.note).toBeNull();
    expect(bm.month.weeks).toHaveLength(5);
    expect(boxes(bm.month.weeks).every((day) => day.items.length === 0)).toBe(true);
    expect(by.empty).toBe("Not laid out yet.");
    expect(by.year.laidOut).toBe(false);
    expect(by.year.months.map((mo) => mo.label)).toEqual([
      "September 2026", "October 2026", "November 2026", "December 2026", "January 2027", "February 2027",
      "March 2027", "April 2027", "May 2027", "June 2027", "July 2027", "August 2027",
    ]);
    expect(by.year.months.every((mo) => mo.items.length === 0)).toBe(true);
  });
});

describe("the day: twenty-four hours and the week's plan for the date", () => {
  it("counts the hours 00 to 23 in four columns of six", () => {
    expect(hourGrid()).toHaveLength(24);
    expect(hourGrid()[0]).toBe("00");
    expect(hourGrid()[9]).toBe("09");
    expect(hourGrid()[23]).toBe("23");
    expect(new Set(hourGrid()).size).toBe(24);
  });

  it("picks the week's row for the date, ticks its done tasks, and reads a task written as a bare string", () => {
    const day = dayPageModel(board.week, DATE);
    expect(day.date).toBe(DATE);
    expect(day.heading).toBe("Monday 7 September 2026");
    expect(day.tasks).toEqual([
      { label: "Cut episode fifteen.", done: true },
      { label: "Press the 1.10 release.", done: false },
      { label: "Post the film.", done: false },
    ]);
    expect(day.hours).toEqual(hourGrid());
  });

  it("has no tasks for a date the week does not plan, and none without a week, and the hours either way", () => {
    expect(dayPageModel(board.week, "2026-09-09").tasks).toEqual([]);
    expect(dayPageModel(undefined, DATE).tasks).toEqual([]);
    expect(dayPageModel(null, DATE).hours).toHaveLength(24);
  });
});

describe("the month as a calendar of weeks, Monday to Sunday", () => {
  it("starts a month that begins on a Monday on its first, with no leading days, and greys the trailing days of the next month", () => {
    const weeks = monthGrid([], "2026-06");
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toMatchObject({ date: "2026-06-01", day: 1, inMonth: true });
    expect(weeks[4][6]).toMatchObject({ date: "2026-07-05", day: 5, inMonth: false });
    expect(boxes(weeks).filter((d) => !d.inMonth).map((d) => d.date)).toEqual([
      "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05",
    ]);
  });

  it("leads a month that begins on a Sunday with six greyed days and runs six rows", () => {
    const weeks = monthGrid([], "2026-03");
    expect(weeks).toHaveLength(6);
    expect(weeks[0].map((d) => [d.day, d.inMonth])).toEqual([[23, false], [24, false], [25, false], [26, false], [27, false], [28, false], [1, true]]);
    expect(weeks[5].map((d) => d.date)).toEqual(["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05"]);
    expect(boxes(weeks).filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("holds thirty days and thirty-one, and never more or fewer than the month has", () => {
    expect(boxes(monthGrid([], "2026-09")).filter((d) => d.inMonth).map((d) => d.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(boxes(monthGrid([], "2026-08")).filter((d) => d.inMonth)).toHaveLength(31);
    expect(boxes(monthGrid([], "2027-02")).filter((d) => d.inMonth)).toHaveLength(28);
    expect(boxes(monthGrid([], "2028-02")).filter((d) => d.inMonth)).toHaveLength(29);
    expect(monthGrid([], "2026-11")).toHaveLength(6);
  });

  it("puts each dated item in its day's box, a span in the box of its first date with its when, a bare date without one", () => {
    const weeks = monthGrid(month.items, "2026-09");
    const byDate = Object.fromEntries(boxes(weeks).map((d) => [d.date, d.items]));
    expect(byDate["2026-09-09"]).toEqual([{ when: null, label: "Ship day: Hansard 1.11 and Henceforth 4.55.", done: false }]);
    expect(byDate["2026-09-14"]).toEqual([{ when: "Mon 14 September to Fri 18 September", label: "The sitting.", done: false }]);
    expect(byDate["2026-09-15"]).toEqual([]);
  });

  it("lands an item on the last day of the month in the last row, and ticks a done one", () => {
    const weeks = monthGrid(month.items, "2026-09");
    const last = weeks[4].find((d) => d.date === "2026-09-30");
    expect(last?.inMonth).toBe(true);
    expect(last?.items).toEqual([{ when: null, label: "The month's last ship day.", done: false }]);
    expect(boxes(weeks).find((d) => d.date === "2026-09-02")?.items).toEqual([{ when: null, label: "Ship day: Henceforth 4.54 shipped.", done: true }]);
  });

  it("keeps two items on one day in the order they were written", () => {
    const items: PlanItem[] = [
      { when: "2026-09-08", label: "Second written, first on the day." },
      { when: "2026-09-08", label: "Written after." },
    ];
    expect(boxes(monthGrid(items, "2026-09")).find((d) => d.date === "2026-09-08")?.items.map((l) => l.label)).toEqual([
      "Second written, first on the day.",
      "Written after.",
    ]);
  });

  it("treats a date that does not exist as words, never as a day", () => {
    expect(boxes(monthGrid([{ when: "2026-02-30", label: "Never" }], "2026-02")).every((d) => d.items.length === 0)).toBe(true);
  });
});

describe("the month's page", () => {
  const page = monthPageModel(month, DATE);

  it("is headed by the month of the plan's first item, carries the note trimmed, and is laid out", () => {
    expect(page.heading).toBe("September 2026");
    expect(page.note).toBe("Drafted on 7 September. Edit freely.");
    expect(page.laidOut).toBe(true);
    expect(page.weeks).toHaveLength(5);
  });

  it("lists the items that fall on no day, a month-wide one and words, under the grid in their own words", () => {
    expect(page.others).toEqual([
      { when: "October", label: "The folklore door opens.", done: false },
      { when: "Later", label: "The Today calendar tab decided.", done: false },
    ]);
  });

  it("falls back to the date's month when the plan opens with words or is absent, and prints empty boxes", () => {
    const words = monthPageModel({ title: "t", items: [{ when: "Later", label: "Something" }] }, "2026-11-02");
    expect(words.heading).toBe("November 2026");
    expect(words.others).toEqual([{ when: "Later", label: "Something", done: false }]);
    const bare = monthPageModel(null, "2026-11-02");
    expect(bare).toMatchObject({ heading: "November 2026", note: null, laidOut: false, others: [] });
    expect(bare.weeks).toHaveLength(6);
    expect(boxes(bare.weeks).every((d) => d.items.length === 0)).toBe(true);
  });
});

describe("the year as twelve months", () => {
  it("runs twelve months from the first, over the year's end, each named with its year", () => {
    const months = yearGrid([], "2026-09");
    expect(months.map((m) => m.month)).toEqual([
      "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08",
    ]);
    expect(months[0].label).toBe("September 2026");
    expect(months[4].label).toBe("January 2027");
    expect(months[11].label).toBe("August 2027");
    expect(yearGrid([], "2026-01").map((m) => m.month)).toEqual(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`));
  });

  it("puts a month-wide item in its month without a when, a dated item with its date, in the order written, and ticks the done one", () => {
    const months = yearGrid(year.items, "2026-09");
    expect(months[0].items).toEqual([
      { when: null, label: "Hansard 1.11 makes the Latest tab the front door.", done: false },
      { when: "Fri 11 September", label: "File the confirmation statement.", done: true },
    ]);
    expect(months[1].items).toEqual([{ when: null, label: "The reach plan's second monthly verdict.", done: false }]);
    expect(months[4].items.map((l) => l.label)).toEqual(["The live-coins wallet built."]);
    expect(months[11].items.map((l) => l.label)).toEqual(["The accounts filed on time."]);
    expect(months.slice(5, 11).every((m) => m.items.length === 0)).toBe(true);
  });
});

describe("the year's page", () => {
  const page = yearPageModel(year, DATE);

  it("is headed by the twelve months' span and is laid out, with no note when the plan has none", () => {
    expect(page.heading).toBe("September 2026 to August 2027");
    expect(page.note).toBeNull();
    expect(page.laidOut).toBe(true);
    expect(page.months).toHaveLength(12);
  });

  it("lists a month beyond the twelve and words under the grid, in their own words", () => {
    expect(page.others).toEqual([
      { when: "September", label: "A year on: the second run.", done: false },
      { when: "Some day", label: "The Mac app better than the iOS app.", done: false },
    ]);
  });

  it("starts from the date's month when the plan is absent, with twelve empty boxes", () => {
    const bare = yearPageModel(undefined, "2027-03-14");
    expect(bare.heading).toBe("March 2027 to February 2028");
    expect(bare.laidOut).toBe(false);
    expect(bare.months.map((m) => m.label).slice(0, 2)).toEqual(["March 2027", "April 2027"]);
    expect(bare.months.every((m) => m.items.length === 0)).toBe(true);
    expect(bare.others).toEqual([]);
  });
});

describe("a when as the page prints it", () => {
  it("spells a date, a month, and the dates inside a span, and leaves words as written", () => {
    expect(whenLabel("2026-09-09")).toBe("Wed 9 September");
    expect(whenLabel("2026-10")).toBe("October");
    expect(whenLabel("2026-09-14 to 2026-09-18")).toBe("Mon 14 September to Fri 18 September");
    expect(whenLabel("  mid-October ")).toBe("mid-October");
    expect(whenLabel("2026-02-30")).toBe("2026-02-30");
  });
});
