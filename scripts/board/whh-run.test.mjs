import { describe, it, expect } from "vitest";
import { assemble } from "./whh-run.mjs";

describe("assemble", () => {
  it("labels the file with the PLAN week (Sun..Sat), not the backward review window", () => {
    const reports = [{ date: "2026-06-29", summary: { reviews: 3, confirmed: 3, rejected: 3, abstained: 1, alreadyResolved: 1, skipped: 1, newConfirmedDefects: 0, boardMoves: 1, verdictsSurvivedRefutation: "10/10" }, apps: [] }];
    const weekStrip = [{ date: "2026-06-27", weekday: "Sat", reviews: 3, hasReport: true }];
    const w = assemble({ endDate: "2026-06-29", days: 7, reports, board: { cards: [] }, sales: null, weekStrip, generatedAt: "2026-06-29T08:00:00Z" });
    // 2026-06-29 is a Monday; the plan is its Sun..Sat week (06-28..07-04),
    // NOT the trailing review window (06-23..06-29) the retro still uses.
    expect(w.weekOf).toBe("2026-06-28");
    expect(w.weekEnd).toBe("2026-07-04");
    expect(w.retro.weekPlan).toHaveLength(7);
    expect(w.retro.weekPlan[0].date).toBe(w.weekOf);
    expect(w.retro.weekPlan.at(-1).date).toBe(w.weekEnd);
    // The retro window is unchanged — daysCovered is still the trailing window.
    expect(w.daysCovered).toEqual(["2026-06-29"]);
    expect(w.retro.totals.reviews).toBe(3);
    expect(w.retro.weekStrip).toEqual(weekStrip);
    expect(w.sales.note).toMatch(/not configured/i);
  });

  it("a Saturday run plans the UPCOMING week — the reviewed Sun..Sat week is complete", () => {
    // 2026-07-11 is a Saturday: the week 07-05..07-11 just finished, so the
    // plan rolls to next week 07-12..07-18.
    const w = assemble({ endDate: "2026-07-11", days: 7, reports: [], board: { cards: [] }, sales: null, generatedAt: "x" });
    expect(w.weekOf).toBe("2026-07-12");
    expect(w.weekEnd).toBe("2026-07-18");
    expect(w.retro.weekPlan[0].date).toBe("2026-07-12");
  });

  it("a Sunday run plans the week just starting", () => {
    // 2026-07-05 is a Sunday: plan this week 07-05..07-11.
    const w = assemble({ endDate: "2026-07-05", days: 7, reports: [], board: { cards: [] }, sales: null, generatedAt: "x" });
    expect(w.weekOf).toBe("2026-07-05");
    expect(w.weekEnd).toBe("2026-07-11");
  });

  it("passes a provided sales object through unchanged", () => {
    const w = assemble({ endDate: "2026-06-29", days: 7, reports: [], board: { cards: [] }, sales: { window: { thisWeek: "2026-06-29", lastWeek: "2026-06-22" }, perApp: [], drivers: [] }, generatedAt: "x" });
    expect(w.sales.window.lastWeek).toBe("2026-06-22");
    expect(w.sales.note).toBeUndefined();
    expect(w.retro.weekStrip).toEqual([]); // defaults to empty when not provided
  });
});
