import { describe, it, expect } from "vitest";
import { mergeByDate, yesterdayCount } from "./daily-reach.mjs";

describe("mergeByDate", () => {
  it("lets the newest instance restate an earlier date instead of double-counting", () => {
    const merged = mergeByDate([
      { processingDate: "2026-07-24", byDate: { "2026-07-22": 6, "2026-07-23": 4 } },
      { processingDate: "2026-07-23", byDate: { "2026-07-22": 5 } },
    ]);
    expect(merged).toEqual({ "2026-07-22": 6, "2026-07-23": 4 });
  });

  it("keeps dates only the older instance carries", () => {
    const merged = mergeByDate([
      { processingDate: "2026-07-24", byDate: { "2026-07-23": 2 } },
      { processingDate: "2026-07-21", byDate: { "2026-07-20": 9 } },
    ]);
    expect(merged).toEqual({ "2026-07-20": 9, "2026-07-23": 2 });
  });

  it("returns empty for no instances", () => {
    expect(mergeByDate([])).toEqual({});
  });
});

describe("yesterdayCount", () => {
  it("reads yesterday's row when present", () => {
    expect(yesterdayCount({ "2026-07-24": 4 }, "2026-07-25", "2026-07-25")).toEqual({ date: "2026-07-24", count: 4 });
  });

  it("treats an absent row inside coverage as a real zero", () => {
    expect(yesterdayCount({ "2026-07-22": 6 }, "2026-07-24", "2026-07-25")).toEqual({ date: "2026-07-24", count: 0 });
  });

  it("returns null when Apple has not processed yesterday yet — absence is not zero", () => {
    expect(yesterdayCount({ "2026-07-22": 6 }, "2026-07-23", "2026-07-25")).toEqual({ date: "2026-07-24", count: null });
  });
});
