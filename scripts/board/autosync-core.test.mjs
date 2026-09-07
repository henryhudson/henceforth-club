import { describe, expect, it } from "vitest";
import { latestFromBoardData } from "./autosync-core.mjs";

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
