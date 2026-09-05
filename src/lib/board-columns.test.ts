import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  COLUMN_LABELS,
  columnPageModel,
  isColumnId,
  latestNote,
  type ColumnBoard,
} from "./board-columns";

const DATE = "2026-09-04";

const board: ColumnBoard = {
  generated: "2026-09-04 13:12 · The Board sheet shipped",
  generatedAt: "2026-09-04T12:12:38.319Z",
  cards: [
    {
      id: "r-older",
      col: "review",
      apps: ["hansard", "site"],
      title: "Two digests wait on a flip",
      phase: "YOU: flip or drop the 26 August draft",
      movedAt: "2026-09-01T22:16:00+01:00",
      desc: "**2026-09-04 08:26 · FOURTH MORNING, BOTH STILL DRAFT.** Club main (c4b864b): both read status draft. Hansard 1.10 is in review.\n\n**2026-09-03 08:20 · THIRD MORNING.** Older note.",
    },
    {
      id: "r-newer",
      col: "review",
      apps: ["site"],
      title: "File the confirmation statement",
      phase: "YOU: did the identity check happen?",
      movedAt: "2026-09-03T11:37:14+01:00",
      desc: "**2026-08-26 15:27 · Henceforth has zero recorded downloads. Features will not fix that. One room, one morning.**",
    },
    { id: "h-dated", col: "inprogress", apps: ["henceforth"], title: "In hand, dated", movedAt: "2026-09-02T09:00:00+01:00" },
    { id: "h-undated", col: "inprogress", apps: ["henceforth"], title: "In hand, no stamp", desc: "" },
    { id: "t-august", col: "todo", apps: ["deck"], title: "Deck convert", phase: "PULL: Tuesday 8 September", movedAt: "2026-08-26T15:27:00+01:00", desc: "2026-07-25 sweep · Re-verified on origin/main. Both halves hold." },
    { id: "t-undated-first", col: "todo", apps: ["*"], title: "A rhythm with no stamp", phase: "STANDING: weekly" },
    { id: "t-september", col: "todo", apps: ["site", "henceforth"], title: "Folklore B1", phase: "PULL: B1 in hand", movedAt: "2026-09-01T20:53:57+01:00", desc: "2026-07-14 22:05 → DONE: the render gate holds. More follows." },
    { id: "t-undated-second", col: "todo", apps: ["unknown"], title: "Another with no stamp", desc: "CONFIRMED CRAFT (behaviour-neutral). The `summarise` fold groups on the raw message. Next sentence." },
    { id: "t-today", col: "todo", apps: ["*"], title: "App Store cadence", phase: "STANDING: both payloads staged", movedAt: "2026-09-04T10:09:22+01:00", desc: "**2026-09-04 10:09 · BOTH WEDNESDAY PAYLOADS ARE STAGED.** Hansard 1.11 and Henceforth 4.55 are complete." },
    { id: "b-one", col: "backlog", apps: ["site"], title: "A parked card", phase: "PARKED: fold in on the next touch", movedAt: "2026-08-30T14:24:25+01:00", desc: "No stamp at all on this one. And a second sentence." },
    { id: "d-today", col: "done", apps: ["site"], title: "Done this afternoon", phase: "DONE · pull request 94", movedAt: "2026-09-04T13:12:37+01:00", doneAt: "2026-09-04T13:12:37+01:00", desc: "**2026-09-04 13:12 · SHIPPED (club pull request 94).** A new edition kind." },
    { id: "d-edge-in", col: "done", apps: ["deck"], title: "Done on the first day of the window", doneAt: "2026-08-06T09:00:00+01:00" },
    { id: "d-edge-out", col: "done", apps: ["deck"], title: "Done the day before the window", doneAt: "2026-08-05T23:30:00+01:00" },
    { id: "d-after", col: "done", apps: ["hansard"], title: "Done after this date", doneAt: "2026-09-05T09:00:00+01:00" },
    { id: "d-moved-only", col: "done", apps: ["henceforth"], title: "Done before doneAt existed, moved in August", movedAt: "2026-08-20T08:00:00+01:00" },
    { id: "d-undated", col: "done", apps: ["site"], title: "Done with no stamp at all" },
  ],
};

describe("the five columns and their labels", () => {
  it("names each column the way the sheet does", () => {
    expect(COLUMNS).toEqual(["review", "inprogress", "todo", "backlog", "done"]);
    expect(COLUMN_LABELS).toEqual({
      review: "Waiting on you",
      inprogress: "In hand",
      todo: "This week's pulls and ledgers",
      backlog: "Backlog",
      done: "Done",
    });
    for (const c of COLUMNS) expect(columnPageModel(board, c, DATE)?.label).toBe(COLUMN_LABELS[c]);
  });

  it("rejects a column that is not one of the five", () => {
    expect(columnPageModel(board, "archive", DATE)).toBeNull();
    expect(columnPageModel(board, "", DATE)).toBeNull();
    expect(columnPageModel(board, "Done", DATE)).toBeNull();
    expect(isColumnId("todo")).toBe(true);
    expect(isColumnId("todos")).toBe(false);
  });

  it("carries the date and the board's own stamp, and windows only the done pile", () => {
    const model = columnPageModel(board, "review", DATE)!;
    expect(model.date).toBe(DATE);
    expect(model.stamp).toBe("2026-09-04 13:12");
    expect(model.column).toBe("review");
    for (const c of ["review", "inprogress", "todo", "backlog"]) expect(columnPageModel(board, c, DATE)!.window).toBeNull();
    expect(columnPageModel({ cards: [] }, "review", DATE)!.stamp).toBeNull();
  });
});

describe("the order", () => {
  it("lists a column newest first by its move stamp, with the unstamped last in the board's order", () => {
    const model = columnPageModel(board, "todo", DATE)!;
    expect(model.cards.map((c) => c.id)).toEqual(["t-today", "t-september", "t-august", "t-undated-first", "t-undated-second"]);
    expect(model.total).toBe(5);
  });

  it("reads review and in progress the same way", () => {
    expect(columnPageModel(board, "review", DATE)!.cards.map((c) => c.id)).toEqual(["r-newer", "r-older"]);
    expect(columnPageModel(board, "inprogress", DATE)!.cards.map((c) => c.id)).toEqual(["h-dated", "h-undated"]);
  });
});

describe("the done window", () => {
  it("keeps the thirty days ending on the date, newest first by doneAt, and says so", () => {
    const model = columnPageModel(board, "done", DATE)!;
    expect(model.window).toEqual({ all: false, since: "2026-08-06" });
    expect(model.cards.map((c) => c.id)).toEqual(["d-today", "d-moved-only", "d-edge-in"]);
    expect(model.total).toBe(6);
  });

  it("holds at both edges: the first day of the window is in, the day before is out, the date is in, the day after is out", () => {
    const ids = columnPageModel(board, "done", DATE)!.cards.map((c) => c.id);
    expect(ids).toContain("d-edge-in");
    expect(ids).not.toContain("d-edge-out");
    expect(ids).toContain("d-today");
    expect(ids).not.toContain("d-after");
    expect(ids).not.toContain("d-undated");
  });

  it("moves with the date, so an older page shows that month's done", () => {
    expect(columnPageModel(board, "done", "2026-08-10")!.cards.map((c) => c.id)).toEqual(["d-edge-in", "d-edge-out"]);
    expect(columnPageModel(board, "done", "2026-08-10")!.window).toEqual({ all: false, since: "2026-07-12" });
  });

  it("lets a card done before doneAt existed stand on its move stamp", () => {
    const card = columnPageModel(board, "done", DATE)!.cards.find((c) => c.id === "d-moved-only");
    expect(card?.when).toBe("done 20 August 2026");
  });

  it("shows the whole pile when asked, the unstamped last, and says that instead", () => {
    const model = columnPageModel(board, "done", DATE, { all: true })!;
    expect(model.window).toEqual({ all: true });
    expect(model.cards.map((c) => c.id)).toEqual(["d-after", "d-today", "d-moved-only", "d-edge-in", "d-edge-out", "d-undated"]);
    expect(model.total).toBe(6);
  });

  it("never windows a live column even when asked for all", () => {
    expect(columnPageModel(board, "todo", DATE, { all: true })!.window).toBeNull();
    expect(columnPageModel(board, "todo", DATE, { all: true })!.cards).toHaveLength(5);
  });
});

describe("a card on the page", () => {
  it("is its title, its phase, its apps by name, its date and its latest note's first sentence, never the description", () => {
    const model = columnPageModel(board, "review", DATE)!;
    expect(model.cards[1]).toEqual({
      id: "r-older",
      title: "Two digests wait on a flip",
      phase: "YOU: flip or drop the 26 August draft",
      apps: ["The Hansard", "henceforth.club"],
      when: "moved 1 September 2026",
      note: "FOURTH MORNING, BOTH STILL DRAFT.",
    });
    for (const c of model.cards) expect(Object.keys(c)).not.toContain("desc");
  });

  it("names every app, spells the star as all four, and leaves an unknown app as written", () => {
    const todo = columnPageModel(board, "todo", DATE)!.cards;
    expect(todo.find((c) => c.id === "t-today")?.apps).toEqual(["All four"]);
    expect(todo.find((c) => c.id === "t-september")?.apps).toEqual(["henceforth.club", "Henceforth"]);
    expect(todo.find((c) => c.id === "t-undated-second")?.apps).toEqual(["unknown"]);
  });

  it("has no date and an empty phase and note when the card carries none", () => {
    const card = columnPageModel(board, "inprogress", DATE)!.cards.find((c) => c.id === "h-undated");
    expect(card).toEqual({ id: "h-undated", title: "In hand, no stamp", phase: "", apps: ["Henceforth"], when: null, note: "" });
  });

  it("says done on the done pile and moved elsewhere", () => {
    expect(columnPageModel(board, "done", DATE)!.cards[0].when).toBe("done 4 September 2026");
    expect(columnPageModel(board, "backlog", DATE)!.cards[0].when).toBe("moved 30 August 2026");
  });
});

describe("the latest note's first sentence", () => {
  it("takes the words after a bold date stamp and stops at the first full stop", () => {
    expect(latestNote("**2026-09-04 08:26 · FOURTH MORNING, BOTH STILL DRAFT.** Club main: both read draft. More.")).toBe(
      "FOURTH MORNING, BOTH STILL DRAFT.",
    );
    expect(latestNote("**2026-09-04 13:12 · SHIPPED (club pull request 94).** A new edition kind.")).toBe("SHIPPED (club pull request 94).");
  });

  it("reads a note whose whole paragraph is bold, and one with no bold at all", () => {
    expect(latestNote("**2026-08-26 15:27 · Henceforth has zero recorded downloads. Features will not fix that.**")).toBe(
      "Henceforth has zero recorded downloads.",
    );
    expect(latestNote("2026-07-25 sweep · Re-verified on origin/main. Both halves hold.")).toBe("Re-verified on origin/main.");
    expect(latestNote("2026-07-14 22:05 → DONE: the render gate holds. More follows.")).toBe("DONE: the render gate holds.");
    expect(latestNote("2026-07-21 13:25 FIXED (b7b11eb3 on main). Next.")).toBe("FIXED (b7b11eb3 on main).");
  });

  it("uses only the first paragraph, so an older note never surfaces", () => {
    const note = latestNote("**2026-09-04 08:26 · TODAY.** Today's words.\n\n**2026-09-03 08:20 · YESTERDAY.** Yesterday's words.");
    expect(note).toBe("TODAY.");
    expect(latestNote("First paragraph without a stop\n\nSecond paragraph. With a stop.")).toBe("First paragraph without a stop");
  });

  it("keeps a version number whole, drops code marks, and is empty for no description", () => {
    expect(latestNote("**2026-09-04 10:09 · BOTH PAYLOADS ARE STAGED.** Henceforth 4.55 is complete.")).toBe("BOTH PAYLOADS ARE STAGED.");
    expect(latestNote("The `summarise` fold groups on the raw message. Next.")).toBe("The summarise fold groups on the raw message.");
    expect(latestNote("Henceforth 4.55 is on main. Wednesday needs the bump.")).toBe("Henceforth 4.55 is on main.");
    expect(latestNote(undefined)).toBe("");
    expect(latestNote("   ")).toBe("");
  });

  it("caps a sentence that never ends", () => {
    expect(latestNote(`**2026-09-04 10:09 · ${"word ".repeat(80)}**`)).toHaveLength(200);
  });
});
