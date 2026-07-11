import { describe, it, expect } from "vitest";
import { assemble } from "./whh-run.mjs";

describe("assemble", () => {
  it("labels weekOf/weekEnd with the REVIEWED window; the weekPlan looks a week ahead", () => {
    const reports = [{ date: "2026-06-29", summary: { reviews: 3, confirmed: 3, rejected: 3, abstained: 1, alreadyResolved: 1, skipped: 1, newConfirmedDefects: 0, boardMoves: 1, verdictsSurvivedRefutation: "10/10" }, apps: [] }];
    const weekStrip = [{ date: "2026-06-27", weekday: "Sat", reviews: 3, hasReport: true }];
    const w = assemble({ endDate: "2026-06-29", days: 7, reports, board: { cards: [] }, sales: null, weekStrip, generatedAt: "2026-06-29T08:00:00Z" });
    // Reviewed window = the trailing 7 days ending 06-29.
    expect(w.weekOf).toBe("2026-06-23");
    expect(w.weekEnd).toBe("2026-06-29");
    expect(w.daysCovered).toEqual(["2026-06-29"]);
    expect(w.retro.totals.reviews).toBe(3);
    expect(w.retro.weekStrip).toEqual(weekStrip);
    // The plan is the week ahead (06-29 is a Monday, so its own Sun..Sat week).
    expect(w.retro.weekPlan).toHaveLength(7);
    expect(w.retro.weekPlan[0].date).toBe("2026-06-28");
    expect(w.retro.weekPlan.at(-1).date).toBe("2026-07-04");
    expect(w.sales.note).toMatch(/not configured/i);
  });

  it("a Saturday run: weekOf/weekEnd are the finished Sun..Sat week, weekPlan is NEXT week", () => {
    // 2026-07-11 is a Saturday. Reviewed week = 07-05..07-11 (what the figures
    // describe); the plan rolls to next week 07-12..07-18.
    const w = assemble({ endDate: "2026-07-11", days: 7, reports: [], board: { cards: [] }, sales: null, generatedAt: "x" });
    expect(w.weekOf).toBe("2026-07-05");
    expect(w.weekEnd).toBe("2026-07-11");
    expect(w.retro.weekPlan[0].date).toBe("2026-07-12");
    expect(w.retro.weekPlan.at(-1).date).toBe("2026-07-18");
  });

  it("passes a provided sales object through unchanged", () => {
    const w = assemble({ endDate: "2026-06-29", days: 7, reports: [], board: { cards: [] }, sales: { window: { thisWeek: "2026-06-29", lastWeek: "2026-06-22" }, perApp: [], drivers: [] }, generatedAt: "x" });
    expect(w.sales.window.lastWeek).toBe("2026-06-22");
    expect(w.sales.note).toBeUndefined();
    expect(w.retro.weekStrip).toEqual([]); // defaults to empty when not provided
  });
});
