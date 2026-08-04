import { describe, expect, it } from "vitest";
import { PERIODS, periodById, periodFor } from "./periods";

describe("periodFor", () => {
  it("puts January 2024 in the year ended 31 January 2024, not in 2024", () => {
    // The trap the spreadsheet's year-sheets fell into: a calendar year is the
    // wrong cut for three of the four filed periods.
    expect(periodFor("2024-01-22")?.id).toBe("2023-02-01_2024-01-31");
  });

  it("puts February 2024 in the eleven-month short period", () => {
    expect(periodFor("2024-02-20")?.id).toBe("2024-02-01_2024-12-31");
  });

  it("handles the boundaries inclusively", () => {
    expect(periodFor("2024-01-31")?.id).toBe("2023-02-01_2024-01-31");
    expect(periodFor("2024-02-01")?.id).toBe("2024-02-01_2024-12-31");
    expect(periodFor("2024-12-31")?.id).toBe("2024-02-01_2024-12-31");
    expect(periodFor("2025-01-01")?.id).toBe("2025-01-01_2025-12-31");
  });

  it("places the first recorded transaction in the first period", () => {
    expect(periodFor("2022-01-06")?.id).toBe("2021-12-01_2023-01-31");
  });

  it("returns null outside every known period", () => {
    expect(periodFor("2019-01-01")).toBeNull();
    expect(periodFor("2030-01-01")).toBeNull();
  });
});

describe("PERIODS", () => {
  it("never overlaps and never leaves a gap", () => {
    for (let i = 1; i < PERIODS.length; i++) {
      const previousEnd = new Date(`${PERIODS[i - 1].end}T00:00:00Z`);
      const thisStart = new Date(`${PERIODS[i].start}T00:00:00Z`);
      expect(thisStart.getTime() - previousEnd.getTime()).toBe(86_400_000);
    }
  });

  it("resolves by identifier", () => {
    expect(periodById("2025-01-01_2025-12-31")?.label).toBe(
      "01 January 2025 to 31 December 2025",
    );
    expect(periodById("nonsense")).toBeNull();
  });

  it("builds every identifier from its own bounds", () => {
    for (const p of PERIODS) expect(p.id).toBe(`${p.start}_${p.end}`);
  });
});
