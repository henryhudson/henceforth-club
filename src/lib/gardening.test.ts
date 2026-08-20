import { describe, expect, it } from "vitest";
import { gardenDiary, type GardeningJob } from "./gardening";

const JOBS: GardeningJob[] = [
  { section: "Blueberries — ericaceous feed", date: "2026-08-20", label: null, done: true },
  { section: "Blueberries — ericaceous feed", date: "2026-10-15", label: null, done: false },
  { section: "Lemons — citrus feed", date: "2026-08-20", label: null, done: true },
  { section: "Lemons — citrus feed", date: "2026-08-27", label: null, done: false },
  { section: "Lemons — citrus feed", date: "2026-09-03", label: null, done: false },
  { section: "Sci Fri — the week's film", date: "2026-08-21", label: "Second law", done: false },
];

describe("gardenDiary", () => {
  it("returns each section's next undone job, oldest first, excluding named sections", () => {
    expect(gardenDiary(JOBS, "2026-08-20", ["Sci Fri", "Thinking Henceforth"])).toEqual([
      { section: "Lemons — citrus feed", date: "2026-08-27", overdue: false },
      { section: "Blueberries — ericaceous feed", date: "2026-10-15", overdue: false },
    ]);
  });

  it("flags a missed job as overdue rather than hiding it", () => {
    const diary = gardenDiary(JOBS, "2026-09-01", ["Sci Fri"]);
    expect(diary[0]).toEqual({ section: "Lemons — citrus feed", date: "2026-08-27", overdue: true });
  });

  it("skips a section whose every job is done", () => {
    const done: GardeningJob[] = [{ section: "Roses", date: "2026-08-01", label: null, done: true }];
    expect(gardenDiary(done, "2026-08-20")).toEqual([]);
  });
});
