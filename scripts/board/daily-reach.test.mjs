import { describe, it, expect } from "vitest";
import { buildReach, coverageThrough, mergeByDate, readCounter, yesterdayCount } from "./daily-reach.mjs";

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

describe("coverageThrough", () => {
  it("reads coverage from the newest row, not the processingDate — an instance processed on day D carries data only through D minus one", () => {
    expect(
      coverageThrough([{ processingDate: "2026-07-25", byDate: { "2026-07-23": 3, "2026-07-24": 5 } }]),
    ).toBe("2026-07-24");
  });

  it("falls back to processingDate minus one day when no instance carried rows", () => {
    expect(coverageThrough([{ processingDate: "2026-07-25", byDate: {} }])).toBe("2026-07-24");
  });

  it("is null with no instances at all", () => {
    expect(coverageThrough([])).toBe(null);
  });
});

describe("yesterdayCount", () => {
  it("reads yesterday's row when present", () => {
    expect(yesterdayCount({ "2026-07-24": 4 }, "2026-07-24", "2026-07-25")).toEqual({ date: "2026-07-24", count: 4 });
  });

  it("treats an absent row inside coverage as a real zero", () => {
    // Reachable via the fallback: the newest instance carried no rows (a
    // zero-download day), so coverage runs past the newest dated row.
    expect(yesterdayCount({ "2026-07-22": 6 }, "2026-07-24", "2026-07-25")).toEqual({ date: "2026-07-24", count: 0 });
  });

  it("returns null when Apple has not processed yesterday yet — absence is not zero", () => {
    expect(yesterdayCount({ "2026-07-22": 6 }, "2026-07-23", "2026-07-25")).toEqual({ date: "2026-07-24", count: null });
  });
});

describe("readCounter", () => {
  it("reads a failed response as null, never zero — an authorisation failure is not a count", () => {
    expect(readCounter(false, null)).toBe(null);
    expect(readCounter(false, { result: "7" })).toBe(null);
  });

  it("reads a missing key as a real zero — the counter has no lag", () => {
    expect(readCounter(true, { result: null })).toBe(0);
  });

  it("reads a live counter", () => {
    expect(readCounter(true, { result: "42" })).toBe(42);
  });
});

describe("buildReach", () => {
  const rating = { average: 5, count: 4 };

  it("reads an unprocessed yesterday as null, never 0 — the processingDate does not cover itself", () => {
    // The live defect: an instance processed on the 25th holds rows only
    // through the 24th, so on the 26th yesterday (the 25th) is unprocessed.
    const reach = buildReach("2026-07-26", [
      { app: "hansard", instances: [{ processingDate: "2026-07-25", byDate: { "2026-07-23": 2, "2026-07-24": 1 } }], rating },
    ]);
    expect(reach.dataThrough).toBe("2026-07-24");
    expect(reach.perApp[0].yesterday).toEqual({ date: "2026-07-25", count: null });
  });

  it("emits exactly the shape /board/report consumes — the Reach type in src/lib/board-data.ts", () => {
    const reach = buildReach(
      "2026-07-26",
      [{ app: "deck", instances: [{ processingDate: "2026-07-25", byDate: { "2026-07-24": 2 } }], rating: { average: null, count: 0 } }],
      { yesterday: 12, week: 80, total: 5210 },
    );
    expect(reach).toEqual({
      dataThrough: "2026-07-24",
      perApp: [
        {
          app: "deck",
          yesterday: { date: "2026-07-25", count: null },
          week: { "2026-07-24": 2 },
          rating: { average: null, count: 0 },
        },
      ],
      site: { yesterday: 12, week: 80, total: 5210 },
    });
  });

  it("takes the newest coverage across apps for the top-level dataThrough", () => {
    const reach = buildReach("2026-07-26", [
      { app: "deck", instances: [{ processingDate: "2026-07-25", byDate: { "2026-07-24": 2 } }], rating },
      { app: "hansard", instances: [{ processingDate: "2026-07-24", byDate: { "2026-07-23": 1 } }], rating },
    ]);
    expect(reach.dataThrough).toBe("2026-07-24");
  });

  it("leaves an app with no instances honestly empty", () => {
    const reach = buildReach("2026-07-26", [{ app: "deck", instances: [], rating }]);
    expect(reach.dataThrough).toBe(null);
    expect(reach.perApp[0].yesterday).toEqual({ date: null, count: null });
  });

  it("omits the site block when there is none", () => {
    expect(buildReach("2026-07-26", [], null)).toEqual({ dataThrough: null, perApp: [] });
  });
});
