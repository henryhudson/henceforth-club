import { describe, it, expect } from "vitest";
import { parseBoardJs, formatBoardJs } from "./local-mirror.mjs";

describe("board file codec", () => {
  it("round-trips a board that already carries a week", () => {
    const board = {
      generated: "2026-08-26 12:00",
      cards: [{ id: "c1", col: "todo" }],
      week: { weekOf: "2026-08-23", weekPlan: [{ date: "2026-08-26", weekday: "Wed", isReviewDay: true, tasks: [] }] },
    };
    const text = formatBoardJs(board);
    expect(text.startsWith("window.MORNING_BOARD = ")).toBe(true);
    expect(parseBoardJs(text)).toEqual(board);
  });
});
