import { describe, expect, it } from "vitest";
import { boardBookModel, planPageModel, whenLabel, type BoardPlan, type BookBoard } from "./board-book";
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
    { when: "2026-09-27", label: "Episode eighteen." },
    { when: "Later", label: "The weekly edition carries a page per project." },
  ],
};

const year: BoardPlan = {
  title: "The year from September 2026",
  items: [
    { when: "2026-10", label: "The reach plan's second monthly verdict." },
    { when: "2026-09-11", label: "File the confirmation statement.", done: true },
    { when: "2026-09", label: "Hansard 1.11 makes the Latest tab the front door." },
    { when: "2026-11", label: "Hansard's Today calendar tab decided." },
    { when: "2026-10-16", label: "Sci Fri reaches Maxwell." },
  ],
};

const board: BookBoard = {
  generated: "2026-09-07 09:55 · Monday: the month and year plans seeded",
  cards: [
    { id: "r1", col: "review", title: "File the confirmation statement", phase: "YOU: did the identity check happen?" },
    { id: "t-older", col: "todo", apps: ["deck"], title: "Deck convert", phase: "PULL: Tuesday", movedAt: "2026-09-01T09:00:00+01:00", desc: "2026-09-01 · The sitting is booked. More." },
    { id: "t-newer", col: "todo", apps: ["hansard"], title: "Two Dependabot alerts", phase: "PULL this week", movedAt: "2026-09-07T09:20:00+01:00" },
    { id: "cadence-appstore", col: "todo", apps: ["*"], title: "App Store cadence", phase: "STANDING: both payloads staged", movedAt: "2026-09-04T10:09:22+01:00" },
    { id: "b1", col: "backlog", apps: ["site"], title: "A parked card", phase: "PARKED" },
    { id: "d1", col: "done", title: "Done this morning", doneAt: "2026-09-07T08:00:00+01:00" },
  ],
  week: { weekPlan: [{ date: "2026-09-06", weekday: "Sun", isReviewDay: false, tasks: ["Lay out the week"] }] },
  month,
  year,
};

const report: SheetReport = { decisions: [{ card: "r1", proposal: "today", why: "Done, or re-booked." }] };

describe("the book's pages", () => {
  const book = boardBookModel(board, report, DATE);

  it("runs to do, in progress, the month, the year, in that order, each named for its running foot", () => {
    expect(book.pages.map((p) => [p.id, p.kind, p.title])).toEqual([
      ["todo", "cards", "To do"],
      ["inprogress", "cards", "In progress"],
      ["month", "plan", "The month"],
      ["year", "plan", "The year"],
    ]);
  });

  it("keeps the front page exactly as the sheet makes it", () => {
    expect(book.front).toEqual(boardSheetModel(board, report, DATE));
    expect(book.front.waiting[0].decision).toEqual({ proposal: "today", why: "Done, or re-booked." });
  });

  it("carries every card of the todo column, newest first, the way the column page does", () => {
    const todo = book.pages[0];
    if (todo.kind !== "cards") throw new Error("the first page is the cards to do");
    expect(todo.list).toEqual(columnPage(board, "todo", DATE));
    expect(todo.list.cards.map((c) => c.id)).toEqual(["t-newer", "cadence-appstore", "t-older"]);
    expect(todo.list.cards[2].note).toBe("The sitting is booked.");
    expect(todo.empty).toBe("Nothing to do.");
  });

  it("says nothing is in hand when the in progress column is empty", () => {
    const inHand = book.pages[1];
    if (inHand.kind !== "cards") throw new Error("the second page is the cards in progress");
    expect(inHand.list.cards).toEqual([]);
    expect(inHand.list.total).toBe(0);
    expect(inHand.empty).toBe("Nothing in hand.");
  });

  it("carries the month and the year when the board has them, and null with the not-laid-out line when it has not", () => {
    const [, , m, y] = book.pages;
    if (m.kind !== "plan" || y.kind !== "plan") throw new Error("the last two pages are the plans");
    expect(m.plan?.title).toBe("September 2026");
    expect(m.plan?.note).toBe("Drafted on 7 September. Edit freely.");
    expect(y.plan?.title).toBe("The year from September 2026");
    expect(y.plan?.note).toBeNull();

    const bare = boardBookModel({ ...board, month: undefined, year: null }, null, DATE);
    for (const page of bare.pages.slice(2)) {
      expect(page.kind === "plan" && page.plan).toBeNull();
      expect(page.empty).toBe("Not laid out yet.");
    }
  });
});

describe("the month, grouped by week", () => {
  const page = planPageModel(month, "week");

  it("groups the dated items by the Sunday-to-Saturday week, in date order, a month-wide item after the weeks and words last", () => {
    expect(page?.groups.map((g) => g.label)).toEqual([
      "30 August to 5 September",
      "6 to 12 September",
      "13 to 19 September",
      "27 September to 3 October",
      "October 2026",
      "Later",
    ]);
  });

  it("runs the lines of a week by date, whatever order they were written in", () => {
    expect(page?.groups[1].lines.map((l) => l.when)).toEqual(["Mon 7 September", "Wed 9 September"]);
    expect(page?.groups[3].lines.map((l) => l.when)).toEqual(["Sun 27 September", "Wed 30 September"]);
  });

  it("ticks a done line and leaves the others open", () => {
    expect(page?.groups[1].lines).toEqual([
      { when: "Mon 7 September", label: "The reach plan's first monthly verdict.", done: false },
      { when: "Wed 9 September", label: "Ship day: Hansard 1.11 and Henceforth 4.55.", done: false },
    ]);
    expect(page?.groups[0].lines).toEqual([{ when: "Wed 2 September", label: "Ship day: Henceforth 4.54 shipped.", done: true }]);
  });

  it("keeps items in words together, in the order they were written, in their own words", () => {
    expect(page?.groups[5].lines.map((l) => [l.when, l.label])).toEqual([
      ["Later", "The Today calendar tab decided."],
      ["Later", "The weekly edition carries a page per project."],
    ]);
  });
});

describe("the year, grouped by month", () => {
  const page = planPageModel(year, "month");

  it("groups by the month, in order, with a month-wide item heading its dated ones", () => {
    expect(page?.groups.map((g) => [g.label, g.lines.map((l) => l.when)])).toEqual([
      ["September 2026", ["September", "Fri 11 September"]],
      ["October 2026", ["October", "Fri 16 October"]],
      ["November 2026", ["November"]],
    ]);
  });

  it("ticks the done line", () => {
    expect(page?.groups[0].lines[1]).toEqual({ when: "Fri 11 September", label: "File the confirmation statement.", done: true });
  });

  it("is null for no plan at all, and empty of groups for a plan with no items", () => {
    expect(planPageModel(undefined, "month")).toBeNull();
    expect(planPageModel(null, "week")).toBeNull();
    expect(planPageModel({ title: "Nothing yet", items: [] }, "month")).toEqual({ title: "Nothing yet", note: null, groups: [] });
  });
});

describe("a when as the page prints it", () => {
  it("spells a date, a month, and the dates inside a span, and leaves words as written", () => {
    expect(whenLabel("2026-09-09")).toBe("Wed 9 September");
    expect(whenLabel("2026-10")).toBe("October");
    expect(whenLabel("2026-09-14 to 2026-09-18")).toBe("Mon 14 September to Fri 18 September");
    expect(whenLabel("  mid-October ")).toBe("mid-October");
  });

  it("groups a span by the week its first date falls in", () => {
    const page = planPageModel({ title: "t", items: [{ when: "2026-09-14 to 2026-09-18", label: "The sitting" }] }, "week");
    expect(page?.groups.map((g) => g.label)).toEqual(["13 to 19 September"]);
  });

  it("treats a date that does not exist as words, never as a day", () => {
    expect(whenLabel("2026-02-30")).toBe("2026-02-30");
    const page = planPageModel({ title: "t", items: [{ when: "2026-02-30", label: "Never" }, { when: "2026-03-01", label: "March" }] }, "week");
    expect(page?.groups.map((g) => g.label)).toEqual(["1 to 7 March", "2026-02-30"]);
  });
});
