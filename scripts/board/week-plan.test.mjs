import { describe, it, expect } from "vitest";
import { weekOfFor, setDayEvents, markEventDone } from "./week-plan.mjs";

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
});
