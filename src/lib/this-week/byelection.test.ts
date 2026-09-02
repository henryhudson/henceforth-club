import { describe, expect, it } from "vitest";
import { isWorkingDay, pollDay, pollWindow, workingDaysAfter } from "./byelection";

// England and Wales, from gov.uk, over the span these tests reach into.
const HOLIDAYS = [
  "2026-12-25", // Christmas Day
  "2026-12-28", // Boxing Day, substitute
  "2027-01-01", // New Year's Day
  "2027-03-26", // Good Friday
  "2027-03-29", // Easter Monday
];

describe("a working day, by section 119", () => {
  it("excludes Saturday and Sunday", () => {
    expect(isWorkingDay("2026-09-05", HOLIDAYS)).toBe(false); // Saturday
    expect(isWorkingDay("2026-09-06", HOLIDAYS)).toBe(false); // Sunday
    expect(isWorkingDay("2026-09-07", HOLIDAYS)).toBe(true); // Monday
  });

  it("excludes a bank holiday", () => {
    expect(isWorkingDay("2026-12-25", HOLIDAYS)).toBe(false);
    expect(isWorkingDay("2027-03-29", HOLIDAYS)).toBe(false);
  });

  it("excludes Christmas Eve, which is not a bank holiday", () => {
    expect(HOLIDAYS).not.toContain("2026-12-24");
    expect(isWorkingDay("2026-12-24", HOLIDAYS)).toBe(false);
  });
});

describe("counting working days", () => {
  it("counts from the day after the start, never the start itself", () => {
    // Thursday 3 September plus one working day is Friday the 4th.
    expect(workingDaysAfter("2026-09-03", 1, HOLIDAYS)).toBe("2026-09-04");
    // Plus two skips the weekend to Monday the 7th.
    expect(workingDaysAfter("2026-09-03", 2, HOLIDAYS)).toBe("2026-09-07");
  });

  it("returns the start day itself for a count of nothing", () => {
    expect(workingDaysAfter("2026-09-03", 0, HOLIDAYS)).toBe("2026-09-03");
  });

  it("refuses a count that is not a whole number of days", () => {
    expect(() => workingDaysAfter("2026-09-03", -1, HOLIDAYS)).toThrow();
    expect(() => workingDaysAfter("2026-09-03", 1.5, HOLIDAYS)).toThrow();
  });
});

describe("the polling window", () => {
  it("holds exactly one Thursday, which is the day the poll falls", () => {
    const w = pollWindow("2026-09-03", HOLIDAYS);
    expect(w).toEqual({ earliest: "2026-10-02", latest: "2026-10-12", thursdays: ["2026-10-08"] });
    expect(pollDay("2026-09-03", HOLIDAYS)).toBe("2026-10-08");
  });

  it("still holds one Thursday when the count runs through Christmas", () => {
    const w = pollWindow("2026-12-01", HOLIDAYS);
    expect(w.thursdays).toHaveLength(1);
    expect(w.thursdays[0]).toBe("2027-01-07");
    // Four excluded days inside the count push the window into January.
    expect(w.earliest).toBe("2027-01-05");
  });

  it("moves the poll a week when the writ moves a fortnight", () => {
    expect(pollDay("2026-09-17", HOLIDAYS)).toBe("2026-10-22");
  });
});
