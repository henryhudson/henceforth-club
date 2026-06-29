import { describe, it, expect } from "vitest";
import { assemble } from "./whh-run.mjs";

describe("assemble", () => {
  it("builds a WeekReport with retro numbers and a skipped-sales note when no App Store Connect", () => {
    const reports = [{ date: "2026-06-29", summary: { reviews: 3, confirmed: 3, rejected: 3, abstained: 1, alreadyResolved: 1, skipped: 1, newConfirmedDefects: 0, boardMoves: 1, verdictsSurvivedRefutation: "10/10" }, apps: [] }];
    const w = assemble({ endDate: "2026-06-29", days: 7, reports, board: { cards: [] }, sales: null, generatedAt: "2026-06-29T08:00:00Z" });
    expect(w.weekOf).toBe("2026-06-23");
    expect(w.weekEnd).toBe("2026-06-29");
    expect(w.daysCovered).toEqual(["2026-06-29"]);
    expect(w.retro.totals.reviews).toBe(3);
    expect(w.sales.note).toMatch(/not configured/i);
  });
  it("passes a provided sales object through unchanged", () => {
    const w = assemble({ endDate: "2026-06-29", days: 7, reports: [], board: { cards: [] }, sales: { window: { thisWeek: "2026-06-29", lastWeek: "2026-06-22" }, perApp: [], drivers: [] }, generatedAt: "x" });
    expect(w.sales.window.lastWeek).toBe("2026-06-22");
    expect(w.sales.note).toBeUndefined();
  });
});
