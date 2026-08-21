import { describe, expect, it } from "vitest";
import { parseGardeningSchedule } from "./gardening-core.mjs";

const SCHEDULE = `# Gardening schedule

Intro prose with | a stray pipe | that is not a date row.

## Blueberries — ericaceous feed

Every 8 weeks. Last done 2026-08-20.

| Date | Status |
|------------|--------|
| 2026-08-20 | Done |
| 2026-10-15 | |

## Lemons — citrus feed

| Date | Status |
|------------|--------|
| 2026-08-20 | Done |
| 2026-08-27 | |
| 2026-09-03 | |

## Sci Fri — the week's film

| Date | Film | Status |
|------------|------------------------------------------|--------|
| 2026-08-21 | Second law (staged, reviewed 08-20) | |
`;

describe("parseGardeningSchedule", () => {
  it("flattens sections into dated rows, reading the last column as status", () => {
    const jobs = parseGardeningSchedule(SCHEDULE);
    expect(jobs).toEqual([
      { section: "Blueberries — ericaceous feed", date: "2026-08-20", label: null, done: true },
      { section: "Blueberries — ericaceous feed", date: "2026-10-15", label: null, done: false },
      { section: "Lemons — citrus feed", date: "2026-08-20", label: null, done: true },
      { section: "Lemons — citrus feed", date: "2026-08-27", label: null, done: false },
      { section: "Lemons — citrus feed", date: "2026-09-03", label: null, done: false },
      { section: "Sci Fri — the week's film", date: "2026-08-21", label: "Second law (staged, reviewed 08-20)", done: false },
    ]);
  });

  it("parses a lone-date row as undone — the date is not its own status", () => {
    const jobs = parseGardeningSchedule("## Roses\n\n| 2026-08-28 |\n");
    expect(jobs).toEqual([{ section: "Roses", date: "2026-08-28", label: null, done: false }]);
  });
});

