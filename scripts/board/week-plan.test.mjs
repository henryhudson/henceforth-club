import { describe, it, expect } from "vitest";
import { weekOfFor, setDayEvents, markEventDone, rollForward, weekSliceFromReport, withWeek, patchBoardWeek, tickBoardWeek } from "./week-plan.mjs";

const plan = [
  { date: "2026-06-28", weekday: "Sun", isReviewDay: false, tasks: ["Start Hansard v1"] },
  { date: "2026-06-29", weekday: "Mon", isReviewDay: false, tasks: ["Submit Hansard v1"] },
  { date: "2026-07-01", weekday: "Wed", isReviewDay: true, tasks: ["Publish the article"] },
];

describe("week plan patchers", () => {
  it("weekOfFor returns the Sunday of the week containing the date", () => {
    expect(weekOfFor("2026-07-02")).toBe("2026-06-28"); // Thursday → its Sunday
    expect(weekOfFor("2026-06-28")).toBe("2026-06-28"); // a Sunday maps to itself
  });

  it("setDayEvents replaces only the named day, immutably", () => {
    const next = setDayEvents(plan, "Mon", ["Ship Hansard", "Reply to Apple"]);
    expect(next.find((d) => d.weekday === "Mon").tasks).toEqual(["Ship Hansard", "Reply to Apple"]);
    expect(next.find((d) => d.weekday === "Sun").tasks).toEqual(["Start Hansard v1"]);
    expect(next).not.toBe(plan);
    expect(plan.find((d) => d.weekday === "Mon").tasks).toEqual(["Submit Hansard v1"]); // original untouched
  });

  it("markEventDone flips one matching event to {label, done:true}", () => {
    const next = markEventDone(plan, "Mon", "Submit Hansard v1");
    expect(next.find((d) => d.weekday === "Mon").tasks[0]).toEqual({ label: "Submit Hansard v1", done: true });
    expect(next.find((d) => d.weekday === "Wed").tasks[0]).toBe("Publish the article"); // other days untouched
  });

  it("rollForward moves undone past tasks to today, keeps done ones in place, leaves future days", () => {
    const live = [
      { date: "2026-06-28", weekday: "Sun", isReviewDay: false, tasks: ["Start Hansard", { label: "Prep", done: true }] },
      { date: "2026-06-29", weekday: "Mon", isReviewDay: false, tasks: ["Submit Hansard"] },
      { date: "2026-06-30", weekday: "Tue", isReviewDay: false, tasks: ["Silent refresh"] },
      { date: "2026-07-01", weekday: "Wed", isReviewDay: true, tasks: ["Article"] },
    ];
    const next = rollForward(live, "Tue");
    expect(next.find((d) => d.weekday === "Sun").tasks).toEqual([{ label: "Prep", done: true }]); // done stays
    expect(next.find((d) => d.weekday === "Mon").tasks).toEqual([]); // undone moved out
    expect(next.find((d) => d.weekday === "Tue").tasks).toEqual(["Start Hansard", "Submit Hansard", "Silent refresh"]); // carried first
    expect(next.find((d) => d.weekday === "Wed").tasks).toEqual(["Article"]); // future untouched
    expect(next).not.toBe(live);
  });
});

describe("the live week lives on the board", () => {
  const report = {
    weekOf: "2026-08-20",
    weekEnd: "2026-08-26",
    generatedAt: "2026-08-26T12:00:00.000Z",
    retro: {
      stateOfUnion: "Ship first.",
      weekPlan: [
        { date: "2026-08-23", weekday: "Sun", isReviewDay: false, tasks: [{ label: "Weekly review", done: true }] },
        { date: "2026-08-26", weekday: "Wed", isReviewDay: true, tasks: ["Archive the three apps"] },
      ],
    },
  };
  const board = { generated: "2026-08-26 12:00", cards: [{ id: "c1", col: "todo" }] };

  it("weekSliceFromReport takes the Sunday of the plan, not the review window", () => {
    const slice = weekSliceFromReport(report);
    expect(slice.weekOf).toBe("2026-08-23");
    expect(slice.stateOfUnion).toBe("Ship first.");
    expect(slice.weekPlan).toHaveLength(2);
  });

  it("withWeek attaches the slice without touching cards", () => {
    const next = withWeek(board, weekSliceFromReport(report));
    expect(next.cards).toEqual(board.cards);
    expect(next.week.weekPlan[1].tasks).toEqual(["Archive the three apps"]);
    expect(board.week).toBeUndefined();
  });

  it("patchBoardWeek marks a done label on the board week", () => {
    const live = withWeek(board, weekSliceFromReport(report));
    const next = patchBoardWeek(live, { weekday: "Wed", done: ["Archive the three apps"] });
    expect(next.week.weekPlan.find((d) => d.weekday === "Wed").tasks[0]).toEqual({
      label: "Archive the three apps",
      done: true,
    });
    expect(live.week.weekPlan.find((d) => d.weekday === "Wed").tasks[0]).toBe("Archive the three apps");
  });

  it("tickBoardWeek flips one index and can clear it", () => {
    const live = withWeek(board, weekSliceFromReport(report));
    const ticked = tickBoardWeek(live, { day: "2026-08-26", index: 0, done: true });
    expect(ticked.week.weekPlan.find((d) => d.date === "2026-08-26").tasks[0].done).toBe(true);
    const cleared = tickBoardWeek(ticked, { day: "2026-08-26", index: 0, done: false });
    expect(cleared.week.weekPlan.find((d) => d.date === "2026-08-26").tasks[0]).toEqual({
      label: "Archive the three apps",
    });
  });

  it("patchBoardWeek throws when the board has no week", () => {
    expect(() => patchBoardWeek(board, { weekday: "Wed", events: ["x"] })).toThrow(/no week on the board/);
  });
});
