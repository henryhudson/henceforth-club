import { describe, expect, it } from "vitest";
import {
  LEDGER_CARDS,
  boardSheetModel,
  firstSentence,
  minusDays,
  standingRest,
  trim,
  type SheetBoard,
  type SheetReport,
} from "./board-sheet";

const DATE = "2026-09-04";

const board: SheetBoard = {
  generated: "2026-09-04 10:09 · Friday's plan done: three findings fixed and merged",
  generatedAt: "2026-09-04T09:09:48.938Z",
  cards: [
    { id: "confirmation-statement", col: "review", title: "File the confirmation statement", phase: "YOU: did the identity check happen?" },
    { id: "digest-flip", col: "review", title: "Two digests wait on a flip", phase: "YOU: flip or drop the 26 August draft" },
    { id: "folklore-b1", col: "inprogress", title: "Folklore B1, the quote Henceforth prices", phase: "PULL: B1 in hand" },
    { id: "deck-invite", col: "todo", title: "Deck convert, do not acquire", phase: "PULL: Tuesday 8 September, the conversion sitting" },
    { id: "cadence-appstore", col: "todo", title: "App Store cadence", phase: "STANDING: Henceforth 4.54 live; Hansard 1.10 in review" },
    { id: "henceforth-release-4-45", col: "todo", title: "Henceforth weekly release", phase: "STANDING: 4.54 live, 4.55 staged" },
    { id: "hansard-release-v1", col: "todo", title: "Hansard weekly release", phase: "STANDING: 1.10 in review, 1.11 complete" },
    { id: "deck-update", col: "todo", title: "Deck weekly release", phase: "STANDING: 1.31 live, nothing staged" },
    { id: "ops-parked", col: "todo", title: "A rhythm parked in todo", phase: "STANDING · weekly, from the todo column" },
    { id: "sci-fri", col: "backlog", title: "Sci Fri", phase: "STANDING · every Friday · film 4 cut" },
    { id: "thinking", col: "backlog", title: "Thinking Henceforth", phase: "STANDING: episode 14 live" },
    { id: "someday", col: "backlog", title: "A plain backlog card", phase: "PULL: later" },
    { id: "d1", col: "done", title: "Done this morning", doneAt: "2026-09-04T10:09:22+01:00" },
    { id: "d3", col: "done", title: "Done six days ago", doneAt: "2026-08-29T08:00:00+01:00" },
    { id: "d2", col: "done", title: "Done yesterday", doneAt: "2026-09-03T11:37:14+01:00" },
    { id: "d4", col: "done", title: "Done a week ago", doneAt: "2026-08-28T23:00:00+01:00" },
    { id: "d5", col: "done", title: "Done before doneAt existed" },
    { id: "d6", col: "done", title: "Done after this date", doneAt: "2026-09-05T09:00:00+01:00" },
  ],
  week: {
    weekPlan: [
      { date: "2026-08-30", weekday: "Sun", isReviewDay: false, tasks: [{ label: "Publish the week", done: true }] },
      { date: "2026-08-31", weekday: "Mon", isReviewDay: false, tasks: [] },
      { date: "2026-09-01", weekday: "Tue", isReviewDay: false, tasks: [{ label: "Confirm the store recovery", done: true }] },
      { date: "2026-09-02", weekday: "Wed", isReviewDay: true, tasks: [{ label: "Ship day", done: true }] },
      { date: "2026-09-03", weekday: "Thu", isReviewDay: false, tasks: [{ label: "Coverage wave", done: true }] },
      { date: "2026-09-04", weekday: "Fri", isReviewDay: false, tasks: ["Identity check on One Login", { label: "Stage Wednesday's releases", done: true }] },
      { date: "2026-09-05", weekday: "Sat", isReviewDay: false, tasks: ["Stage episode fifteen"] },
    ],
  },
};

const report: SheetReport = {
  decisions: [
    { card: "confirmation-statement", proposal: "today", why: "Done, or re-booked to a named day." },
    { card: "not-on-the-board", proposal: "today", why: "Ignored." },
  ],
  appStore: {
    shipDay: "2026-09-09",
    rule: "Every Wednesday one app ships an update.",
    apps: [
      { app: "henceforth", status: "live", version: "4.54", daysSince: 1, readyToShip: "true", blocker: "The 4.55 payload is on main. Wednesday needs the bump." },
      { app: "deck", status: "live", version: "1.31", daysSince: 8, readyToShip: "false", blocker: "Nothing staged. The sitting is booked for Tuesday." },
    ],
  },
};

describe("the column partitions", () => {
  const model = boardSheetModel(board, report, DATE);

  it("puts review in waiting, in progress in hand, and the plain todo cards in the pulls", () => {
    expect(model.waiting.map((c) => c.id)).toEqual(["confirmation-statement", "digest-flip"]);
    expect(model.inHand.map((c) => c.id)).toEqual(["folklore-b1"]);
    expect(model.pulls.map((c) => c.id)).toEqual(["deck-invite"]);
  });

  it("carries a title and a one-line phase per card, and never the description", () => {
    expect(model.inHand[0]).toEqual({ id: "folklore-b1", title: "Folklore B1, the quote Henceforth prices", phase: "PULL: B1 in hand" });
    for (const line of [...model.waiting, ...model.inHand, ...model.pulls, ...model.rhythms]) {
      expect(Object.keys(line)).not.toContain("desc");
    }
  });

  it("counts every column and stamps the board's own time", () => {
    expect(model.counts).toEqual({ total: 18, review: 2, inprogress: 1, todo: 6, backlog: 3, done: 6 });
    expect(model.stamp).toBe("2026-09-04 10:09");
    expect(model.date).toBe(DATE);
    expect(model.trimmed).toBe(false);
  });

  it("falls back to generatedAt for the stamp when the prose stamp is missing", () => {
    expect(boardSheetModel({ ...board, generated: undefined }, null, DATE).stamp).toBe("2026-09-04 09:09");
    expect(boardSheetModel({ cards: [] }, null, DATE).stamp).toBe(null);
  });
});

describe("the standing prefix split", () => {
  const model = boardSheetModel(board, report, DATE);

  it("lists the standing backlog cards as rhythms with the prefix stripped, in either spelling", () => {
    expect(model.rhythms.map((c) => [c.id, c.phase])).toEqual([
      ["sci-fri", "every Friday · film 4 cut"],
      ["thinking", "episode 14 live"],
      ["ops-parked", "weekly, from the todo column"],
    ]);
  });

  it("keeps a plain backlog card off the sheet, and the four ship cards out of both the pulls and the rhythms", () => {
    const ids = [...model.pulls, ...model.rhythms].map((c) => c.id);
    expect(ids).not.toContain("someday");
    for (const id of LEDGER_CARDS) expect(ids).not.toContain(id);
  });

  it("reads the prefix and nothing that merely resembles it", () => {
    expect(standingRest("STANDING: every Friday")).toBe("every Friday");
    expect(standingRest("STANDING · direction, not a ticket")).toBe("direction, not a ticket");
    expect(standingRest("STANDING")).toBe("");
    expect(standingRest("STANDINGS are not standing")).toBe(null);
    expect(standingRest("PULL: build it")).toBe(null);
    expect(standingRest(undefined)).toBe(null);
  });
});

describe("the seven-day done window", () => {
  it("keeps the cards done in the seven days ending on the date, newest first, titles only", () => {
    const model = boardSheetModel(board, report, DATE);
    expect(model.doneThisWeek).toEqual(["Done this morning", "Done yesterday", "Done six days ago"]);
  });

  it("excludes the day before the window, a card with no doneAt, and a card done after the date", () => {
    const titles = boardSheetModel(board, report, DATE).doneThisWeek;
    expect(titles).not.toContain("Done a week ago");
    expect(titles).not.toContain("Done before doneAt existed");
    expect(titles).not.toContain("Done after this date");
  });

  it("moves with the date, so an older sheet shows that week's done", () => {
    expect(boardSheetModel(board, report, "2026-08-29").doneThisWeek).toEqual(["Done six days ago", "Done a week ago"]);
  });

  it("counts calendar days across a month end", () => {
    expect(minusDays("2026-09-04", 6)).toBe("2026-08-29");
    expect(minusDays("2026-03-02", 6)).toBe("2026-02-24");
  });
});

describe("the proposal join", () => {
  const model = boardSheetModel(board, report, DATE);

  it("attaches the report's proposal to the review card it names, and nothing to the others", () => {
    expect(model.waiting[0].decision).toEqual({ proposal: "today", why: "Done, or re-booked to a named day." });
    expect(model.waiting[1].decision).toBeUndefined();
  });

  it("carries no proposals when there is no report", () => {
    const bare = boardSheetModel(board, null, DATE);
    expect(bare.waiting.every((c) => c.decision === undefined)).toBe(true);
  });
});

describe("the ship ledgers", () => {
  it("takes one row per app from the report's storefront state, with the blocker cut to its first sentence", () => {
    const { ledger } = boardSheetModel(board, report, DATE);
    expect(ledger.source).toBe("storefront");
    expect(ledger.rows).toEqual([
      { app: "Henceforth", status: "live", version: "4.54", daysSince: 1, ready: true, note: "The 4.55 payload is on main." },
      { app: "Deck of Cards", status: "live", version: "1.31", daysSince: 8, ready: false, note: "Nothing staged." },
    ]);
  });

  it("falls back to the four standing cards' phase lines, in ledger order, when the report is absent", () => {
    const { ledger } = boardSheetModel(board, null, DATE);
    expect(ledger.source).toBe("cards");
    expect(ledger.rows).toEqual([
      { id: "cadence-appstore", title: "App Store cadence", phase: "Henceforth 4.54 live; Hansard 1.10 in review" },
      { id: "henceforth-release-4-45", title: "Henceforth weekly release", phase: "4.54 live, 4.55 staged" },
      { id: "hansard-release-v1", title: "Hansard weekly release", phase: "1.10 in review, 1.11 complete" },
      { id: "deck-update", title: "Deck weekly release", phase: "1.31 live, nothing staged" },
    ]);
  });

  it("falls back the same way when the report carries no storefront state, and skips a ledger card the board lacks", () => {
    const fewer = { ...board, cards: board.cards.filter((c) => c.id !== "hansard-release-v1") };
    const { ledger } = boardSheetModel(fewer, { decisions: [] }, DATE);
    expect(ledger.source).toBe("cards");
    expect(ledger.rows.map((r) => ("id" in r ? r.id : ""))).toEqual(["cadence-appstore", "henceforth-release-4-45", "deck-update"]);
  });

  it("reads readiness as a boolean or as a word, and cuts a sentence without swallowing a version number", () => {
    const boolean = { ...report, appStore: { ...report!.appStore!, apps: [{ ...report!.appStore!.apps[0], readyToShip: true as unknown as string }] } };
    expect(boardSheetModel(board, boolean, DATE).ledger.rows[0]).toMatchObject({ ready: true });
    expect(firstSentence("The 4.55 payload is on main. Wednesday needs the bump.")).toBe("The 4.55 payload is on main.");
    expect(firstSentence("No full stop at all")).toBe("No full stop at all");
    expect(firstSentence("x".repeat(200))).toHaveLength(110);
  });
});

describe("the week", () => {
  it("prints all seven rows with a tick per task, strings unticked and objects as they say", () => {
    const { week } = boardSheetModel(board, report, DATE);
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.label)).toEqual(["Sun 30", "Mon 31", "Tue 1", "Wed 2", "Thu 3", "Fri 4", "Sat 5"]);
    expect(week[1].tasks).toEqual([]);
    expect(week[5].tasks).toEqual([
      { label: "Identity check on One Login", done: false },
      { label: "Stage Wednesday's releases", done: true },
    ]);
  });

  it("is empty when the board carries no week", () => {
    expect(boardSheetModel({ ...board, week: undefined }, report, DATE).week).toEqual([]);
  });
});

describe("trimming for room", () => {
  it("drops the done strip whole, first and before anything else", () => {
    const model = boardSheetModel(board, report, DATE);
    const trimmed = trim(model);
    expect(trimmed).not.toBeNull();
    expect(trimmed!.doneThisWeek).toEqual([]);
    expect(trimmed!.trimmed).toBe(true);
    // Every other part of the working set is exactly as it was.
    expect({ ...trimmed!, doneThisWeek: model.doneThisWeek, trimmed: false }).toEqual(model);
  });

  it("has nothing further to trim once the strip is gone: the render refuses the page instead", () => {
    const model = boardSheetModel(board, report, DATE);
    expect(trim(trim(model)!)).toBeNull();
    expect(trim(boardSheetModel({ cards: [] }, null, DATE))).toBeNull();
  });
});
