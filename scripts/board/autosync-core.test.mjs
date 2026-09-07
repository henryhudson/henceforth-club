import { describe, expect, it } from "vitest";
import { boardLooksCollapsed, collapseCounts, latestFromBoardData } from "./autosync-core.mjs";

const AT = "2026-09-03T00:10:00.000Z";
const withWeek = `window.MORNING_BOARD = {
  generated: "2026-09-03 00:01 · a line",
  cards: [{ id: "a", rev: 1 }],
  week: { weekOf: "2026-08-30", weekPlan: [{ weekday: "Wed", date: "2026-09-02", tasks: [{ label: "Ship day", done: true }] }] },
  log: ["not rendered"],
};`;

describe("latestFromBoardData", () => {
  it("carries the week through to the mirror, with the done marks it holds", () => {
    const latest = latestFromBoardData(withWeek, AT);
    expect(latest.generatedAt).toBe(AT);
    expect(latest.cards).toEqual([{ id: "a", rev: 1 }]);
    expect(latest.week?.weekPlan[0].tasks[0]).toEqual({ label: "Ship day", done: true });
    expect("log" in latest).toBe(false);
  });

  it("writes no week field when the board has none", () => {
    const latest = latestFromBoardData(`window.MORNING_BOARD = { generated: "x", cards: [] };`, AT);
    expect("week" in latest).toBe(false);
  });

  it("carries the month and the year through to the mirror, whole, and writes neither when the board has none", () => {
    const month = { title: "September 2026", note: "Drafted on the 7th.", items: [{ when: "2026-09-09", label: "Ship day", done: false }] };
    const year = { title: "The year from September 2026", items: [{ when: "2026-10", label: "The folklore door opens" }] };
    const src = `window.MORNING_BOARD = { generated: "x", cards: [], month: ${JSON.stringify(month)}, year: ${JSON.stringify(year)} };`;
    const latest = latestFromBoardData(src, AT);
    expect(latest.month).toEqual(month);
    expect(latest.year).toEqual(year);
    expect(Object.keys(latest)).toEqual(["generated", "generatedAt", "cards", "month", "year"]);

    const bare = latestFromBoardData(withWeek, AT);
    expect("month" in bare).toBe(false);
    expect("year" in bare).toBe(false);
  });

  it("throws on a file that does not yield a board, as a mid-edit save looks", () => {
    expect(() => latestFromBoardData(`window.MORNING_BOARD = { generated: "x" `, AT)).toThrow();
    expect(() => latestFromBoardData(`window.OTHER = {};`, AT)).toThrow(/mid-edit/);
  });
});

const cards = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, rev: 1 }));
const boardJs = (generated, n) => `window.MORNING_BOARD = ${JSON.stringify({ generated, cards: cards(n) })};`;
// The mirror as it stood on 7 September 2026 when a stray test wrote a
// one-card fixture board over the canonical file.
const lastGood = { generated: "2026-09-07 13:30 · Monday: The Counting House delivered", generatedAt: "2026-09-07T10:54:28.034Z", cards: cards(424) };

describe("the mirror against the last good board", () => {
  it("refuses a board that has collapsed, naming both counts, and the last good mirror stands", () => {
    expect(() => latestFromBoardData(boardJs("2026-09-07 08:08 · Monday", 1), AT, lastGood)).toThrow(
      "REFUSED a collapsed board: 1 card dated 2026-09-07 08:08 against the last good 424 cards dated 2026-09-07 13:30; the last good mirror stands",
    );
  });

  it("lets a board shrink by a few cards, as a morning that clears done cards does", () => {
    expect(latestFromBoardData(boardJs("2026-09-08 07:30 · Tuesday", 418), AT, lastGood).cards).toHaveLength(418);
  });

  it("lets the first board through when no mirror stands yet", () => {
    expect(latestFromBoardData(boardJs("2026-09-07 08:08 · Monday", 1), AT, null).cards).toHaveLength(1);
    expect(latestFromBoardData(boardJs("2026-09-07 08:08 · Monday", 1), AT).cards).toHaveLength(1);
  });

  it("refuses a board whose dateline has gone back a day, however many cards it holds", () => {
    expect(() => latestFromBoardData(boardJs("2026-09-06 23:00 · Sunday", 430), AT, lastGood)).toThrow(/REFUSED a collapsed board: 430 cards dated 2026-09-06 23:00/);
  });
});

describe("boardLooksCollapsed", () => {
  it("draws the line at half the last good count, and at its calendar date", () => {
    expect(boardLooksCollapsed({ generated: "2026-09-07 14:00", cards: cards(212) }, lastGood)).toBe(false);
    expect(boardLooksCollapsed({ generated: "2026-09-07 14:00", cards: cards(211) }, lastGood)).toBe(true);
    // Earlier the same day is still the same date.
    expect(boardLooksCollapsed({ generated: "2026-09-07 08:08", cards: cards(424) }, lastGood)).toBe(false);
    expect(boardLooksCollapsed({ generated: "2026-09-06 08:08", cards: cards(424) }, lastGood)).toBe(true);
  });

  it("reads no dateline as no evidence, and no last good board as nothing to collapse from", () => {
    expect(boardLooksCollapsed({ generated: "x", cards: cards(424) }, lastGood)).toBe(false);
    expect(boardLooksCollapsed({ generated: "2026-09-07 14:00", cards: cards(424) }, { generated: "x", cards: cards(424) })).toBe(false);
    expect(boardLooksCollapsed({ generated: "x", cards: [] }, null)).toBe(false);
    expect(boardLooksCollapsed({ generated: "x", cards: [] }, undefined)).toBe(false);
  });

  it("collapseCounts names both boards by cards and dateline", () => {
    expect(collapseCounts({ generated: "2026-09-07 08:08 · Monday", cards: cards(1) }, lastGood)).toBe(
      "1 card dated 2026-09-07 08:08 against the last good 424 cards dated 2026-09-07 13:30",
    );
  });
});
