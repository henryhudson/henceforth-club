import { describe, it, expect } from "vitest";
import { parseDownloadsCsv, unitsOverWindows } from "./asc-analytics.mjs";
import { coverageThrough, mergeByDate } from "./daily-reach-core.mjs";

describe("parseDownloadsCsv", () => {
  it("sums download Counts per date and excludes non-download types", () => {
    const csv = [
      "Date\tApp Name\tDownload Type\tTerritory\tCounts",
      "2026-06-28\tDeck\tFirst-time download\tUS\t4",
      "2026-06-28\tDeck\tRedownload\tGB\t2",
      "2026-06-28\tDeck\tUpdate\tUS\t40",   // updates are not downloads
      "2026-06-27\tDeck\tFirst-time download\tUS\t5",
    ].join("\n");
    const byDate = parseDownloadsCsv(csv);
    expect(byDate["2026-06-28"]).toBe(6);
    expect(byDate["2026-06-27"]).toBe(5);
  });

  it("returns empty for an empty or column-less report", () => {
    expect(parseDownloadsCsv("")).toEqual({});
    expect(parseDownloadsCsv("Foo\tBar\n1\t2")).toEqual({});
  });
});

// The seven days of a window, ending at `end`.
const window7 = (end) =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(new Date(end + "T00:00:00Z").getTime() - (6 - i) * 86400000).toISOString().slice(0, 10));

describe("unitsOverWindows", () => {
  it("reads every instance, not just the newest, so a week is not undercounted", () => {
    // The shape that made the weekly review report 17 for a week the daily read at 38: Apple
    // splits the week across several overlapping instances and the newest holds only its own
    // two days. Reading one instance sees two days; merging sees the week.
    const instances = [
      { processingDate: "2026-09-01", byDate: { "2026-08-30": 3, "2026-08-31": 8 } },
      { processingDate: "2026-09-03", byDate: { "2026-09-01": 5, "2026-09-02": 5 } },
      { processingDate: "2026-09-05", byDate: { "2026-09-03": 9, "2026-09-04": 8 } },
    ];
    const merged = mergeByDate(instances);
    const through = coverageThrough(instances);
    expect(through).toBe("2026-09-04");

    const units = unitsOverWindows(merged, through, window7("2026-09-06"), window7("2026-08-30"));
    // 31 Aug to 4 Sep inside coverage: 8 + 5 + 5 + 9 + 8. The newest instance alone gives 17.
    expect(units.thisWeek).toBe(35);
  });

  it("restates a date from the newer instance instead of summing the two", () => {
    // Apple revises: a later instance carries a corrected count for a date an earlier one
    // already reported. Summing would double-count; last write wins.
    const instances = [
      { processingDate: "2026-09-04", byDate: { "2026-09-02": 4 } },
      { processingDate: "2026-09-05", byDate: { "2026-09-02": 6, "2026-09-03": 1 } },
    ];
    const units = unitsOverWindows(
      mergeByDate(instances), coverageThrough(instances),
      window7("2026-09-04"), window7("2026-08-28"),
    );
    expect(units.thisWeek).toBe(7); // 6 + 1, not 4 + 6 + 1
  });

  it("drops the days beyond coverage from BOTH windows, so lag is not read as a fall", () => {
    // Every day of both weeks had two downloads, and Apple has processed only five of this
    // week's seven — so the report carries all of last week and only 31 Aug to 4 Sep of this
    // one. Ten against a full last week of fourteen would read as down 29 per cent.
    const byDate = {};
    for (const d of [...window7("2026-08-30"), ...window7("2026-09-06").slice(0, 5)]) byDate[d] = 2;
    const instances = [{ processingDate: "2026-09-05", byDate }];
    const units = unitsOverWindows(
      mergeByDate(instances), coverageThrough(instances),
      window7("2026-09-06"), window7("2026-08-30"),
    );
    expect(units.thisWeek).toBe(10); // 31 Aug to 4 Sep
    expect(units.lastWeek).toBe(10); // the SAME five positions of the week before
    expect(units.deltaPct).toBe(0);
  });

  it("calls an unprocessed week unknown rather than zero", () => {
    // Apple's coverage stops before the window opens. The old reader summed the absent dates
    // to 0 and printed a flat zero week beside a real one.
    const instances = [{ processingDate: "2026-08-20", byDate: { "2026-08-18": 4 } }];
    expect(unitsOverWindows(mergeByDate(instances), coverageThrough(instances), window7("2026-09-06"), window7("2026-08-30")))
      .toEqual({ thisWeek: null, lastWeek: null, deltaPct: null });
  });

  it("is unknown, not zero, for an app whose report Apple has not generated at all", () => {
    expect(unitsOverWindows({}, null, window7("2026-09-06"), window7("2026-08-30")))
      .toEqual({ thisWeek: null, lastWeek: null, deltaPct: null });
  });

  it("counts a processed day with no rows as the real zero it is", () => {
    // A date inside coverage that the merged map has no key for had no downloads; only dates
    // beyond coverage are unknown.
    const instances = [{ processingDate: "2026-09-06", byDate: { "2026-09-02": 3 } }];
    const units = unitsOverWindows(
      mergeByDate(instances), coverageThrough(instances),
      window7("2026-09-05"), window7("2026-08-29"),
    );
    expect(units.thisWeek).toBe(3); // the other six covered days are zeros, not unknowns
    expect(units.lastWeek).toBe(0);
    expect(units.deltaPct).toBe(null); // no baseline to divide by
  });
});
