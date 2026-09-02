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

  it("throws on a file that does not yield a board, as a mid-edit save looks", () => {
    expect(() => latestFromBoardData(`window.MORNING_BOARD = { generated: "x" `, AT)).toThrow();
    expect(() => latestFromBoardData(`window.OTHER = {};`, AT)).toThrow(/mid-edit/);
  });
});
