import { afterEach, describe, expect, it } from "vitest";
import { asList, datesBetween, editionIndex, editionNumber, isRowHigh, longDate, machineHogs, machineLine, reachAppLine, reachCell, shippedByDay, sparkPoints, verdictLine } from "./report-helpers";
import type { MachineReading } from "./board-data";

describe("longDate", () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

  it("names the day the way it is read aloud", () => {
    expect(longDate("2026-07-27")).toBe("Monday 27th of July 2026");
    expect(longDate("2026-07-28")).toBe("Tuesday 28th of July 2026");
  });

  it("gets the ordinal right, including the teens that catch naive versions", () => {
    expect(longDate("2026-07-01")).toBe("Wednesday 1st of July 2026");
    expect(longDate("2026-07-02")).toBe("Thursday 2nd of July 2026");
    expect(longDate("2026-07-03")).toBe("Friday 3rd of July 2026");
    expect(longDate("2026-07-11")).toBe("Saturday 11th of July 2026");
    expect(longDate("2026-07-12")).toBe("Sunday 12th of July 2026");
    expect(longDate("2026-07-13")).toBe("Monday 13th of July 2026");
    expect(longDate("2026-07-21")).toBe("Tuesday 21st of July 2026");
    expect(longDate("2026-07-22")).toBe("Wednesday 22nd of July 2026");
    expect(longDate("2026-07-23")).toBe("Thursday 23rd of July 2026");
  });

  it("keeps the day name in the renderer's timezone-free reading", () => {
    // The print edition renders headless and Vercel runs in UTC, so an
    // unpinned formatter would date this edition Sunday west of Greenwich.
    process.env.TZ = "Pacific/Honolulu";
    expect(longDate("2026-07-27")).toBe("Monday 27th of July 2026");
    process.env.TZ = "Pacific/Auckland";
    expect(longDate("2026-07-27")).toBe("Monday 27th of July 2026");
  });

  it("passes an unparseable date through rather than rendering Invalid Date", () => {
    expect(longDate("not-a-date")).toBe("not-a-date");
  });
});

describe("editionNumber", () => {
  const run = ["2026-07-26", "2026-07-24", "2026-07-25"];

  it("counts from the oldest edition, whatever order the list arrives in", () => {
    expect(editionNumber(run, "2026-07-24")).toBe(1);
    expect(editionNumber(run, "2026-07-25")).toBe(2);
    expect(editionNumber(run, "2026-07-26")).toBe(3);
  });

  it("does not double-count a date the store lists twice", () => {
    expect(editionNumber([...run, "2026-07-24"], "2026-07-26")).toBe(3);
  });

  it("returns null rather than a confident wrong number for an unknown date", () => {
    // The masthead prints this. A missing edition must leave the slot blank,
    // never claim an issue number the run does not have.
    expect(editionNumber(run, "2026-07-27")).toBeNull();
    expect(editionNumber([], "2026-07-27")).toBeNull();
  });
});

describe("asList", () => {
  it("joins a list with middle dots", () => {
    expect(asList(["a", "b"])).toBe("a · b");
  });
  it("passes a plain string through (older reports)", () => {
    expect(asList("just this")).toBe("just this");
  });
  it("renders absent as empty", () => {
    expect(asList(undefined)).toBe("");
  });
});

describe("reachAppLine", () => {
  it("reads a real zero as zero downloads", () => {
    expect(reachAppLine("deck", { date: "2026-07-24", count: 0 }, { "2026-07-22": 6, "2026-07-23": 4 })).toBe(
      "deck — 0 downloads yesterday · 10 in the window",
    );
  });
  it("never renders an unprocessed day as zero", () => {
    expect(reachAppLine("hansard", { date: "2026-07-24", count: null })).toBe(
      "hansard — yesterday not yet processed",
    );
  });
  it("singularizes one download and appends a rating when one exists", () => {
    expect(
      reachAppLine("henceforth", { date: "2026-07-24", count: 1 }, undefined, { average: 5, count: 2 }),
    ).toBe("henceforth — 1 download yesterday · rating 5.0 of 5 from 2");
  });
  it("omits the rating when nobody has rated", () => {
    expect(reachAppLine("hansard", { date: "2026-07-24", count: 0 }, {}, { average: 0, count: 0 })).toBe(
      "hansard — 0 downloads yesterday · 0 in the window",
    );
  });
});

describe("verdictLine", () => {
  it("orders confirmed, rejected, abstained, already fixed", () => {
    const findings = [
      { verdict: "agree" }, { verdict: "agree" },
      { verdict: "reject" }, { verdict: "abstain" }, { verdict: "already-resolved" },
    ];
    expect(verdictLine(findings)).toBe("2 confirmed · 1 rejected · 1 abstained · 1 already fixed");
  });
  it("omits zero buckets", () => {
    expect(verdictLine([{ verdict: "reject" }])).toBe("1 rejected");
  });
  it("reads 'no findings' for an empty list", () => {
    expect(verdictLine([])).toBe("no findings");
  });
  it("counts unknown verdicts as abstained", () => {
    expect(verdictLine([{ verdict: "shrug" }])).toBe("1 abstained");
  });
});

describe("reachCell", () => {
  it("renders an unprocessed day as an em dash, not zero", () => {
    expect(reachCell(null)).toBe("—");
    expect(reachCell(undefined)).toBe("—");
  });
  it("renders a real zero as 0", () => {
    expect(reachCell(0)).toBe("0");
  });
  it("renders a counted day as the number", () => {
    expect(reachCell(19)).toBe("19");
  });
});

describe("sparkPoints", () => {
  it("returns null when fewer than two numbers exist", () => {
    expect(sparkPoints([])).toBeNull();
    expect(sparkPoints([null, 4, null])).toBeNull();
    expect(sparkPoints([19])).toBeNull();
  });
  it("puts the row high at the top of the view and keeps nulls as x-gaps", () => {
    const pts = sparkPoints([10, 9, 5, 4, 6, 19], 42, 10);
    expect(pts).not.toBeNull();
    const ys = pts!.split(" ").map((p) => Number(p.split(",")[1]));
    expect(ys[5]).toBeLessThan(ys[3]);
    expect(Math.min(...ys)).toBeCloseTo(0.5, 5);
  });
  it("plots a level between its own low and high when told the floor is not zero", () => {
    // Free space moving 23.0 to 15.5 GiB: on a zero floor the line is nearly
    // flat; between its own ends it spans the whole view.
    const level = [23.0, 22.4, null, 17.9, 16.2, 19.8, 15.5];
    const zeroYs = sparkPoints(level)!.split(" ").map((p) => Number(p.split(",")[1]));
    const ownYs = sparkPoints(level, 42, 10, false)!.split(" ").map((p) => Number(p.split(",")[1]));
    expect(Math.max(...zeroYs) - Math.min(...zeroYs)).toBeLessThan(4);
    expect(Math.min(...ownYs)).toBeCloseTo(0.5, 5);
    expect(Math.max(...ownYs)).toBeCloseTo(9.5, 5);
    expect(ownYs).toHaveLength(6); // the null keeps its x slot and is not plotted
  });
});

describe("the machines' lines", () => {
  const laptop: MachineReading = {
    host: "laptop", readAt: "2026-09-04T16:10:35.281Z",
    data: { sizeGiB: 460.4, freeGiB: 15.5, usedPct: 96.6 },
    swap: { totalMiB: 5120, usedMiB: 3582.1 },
    memoryGiB: 16, load1: 1.9, uptimeDays: 4.6,
    consumers: [
      { label: "CoreSimulator", path: "/Users/h/Library/Developer/CoreSimulator", gib: 64.9 },
      { label: "DerivedData", path: "/Users/h/Library/Developer/Xcode/DerivedData", gib: 8.9 },
      { label: "Caches", path: "/Users/h/Library/Caches", gib: 3.6 },
      { label: "Archives", path: "/Users/h/Library/Developer/Xcode/Archives", gib: 0.7 },
    ],
    runtimes: { count: 7, gib: 56.1 },
  };
  const mini: MachineReading = {
    host: "mini", readAt: "2026-09-04T16:10:35.291Z",
    data: { sizeGiB: 460.4, freeGiB: 232.6, usedPct: 49.5 },
    swap: { totalMiB: 4096, usedMiB: 2409.1 },
    memoryGiB: 8, load1: 1.3, uptimeDays: 1, runners: 3,
    consumers: [{ label: "actions-runner", path: "/Users/h/actions-runner/_work", gib: 0.7 }],
    xcresults: { count: 4, gib: 0.2 },
  };
  it("machineLine reads the volume, the swap in GiB, the load and the uptime", () => {
    expect(machineLine(laptop)).toBe("15.5 of 460.4 GiB free (96.6% used) · swap 3.5 of 5.0 GiB · load 1.9 · up 4.6 days");
  });
  it("machineLine adds the mini's runner count and reads one day singular", () => {
    expect(machineLine(mini)).toBe("232.6 of 460.4 GiB free (49.5% used) · swap 2.4 of 4.0 GiB · load 1.3 · up 1 day · 3 runners");
  });
  it("machineHogs names the top consumers, capped", () => {
    expect(machineHogs(laptop)).toBe("CoreSimulator 64.9 GiB, DerivedData 8.9 GiB, Caches 3.6 GiB");
    expect(machineHogs(laptop, 4)).toMatch(/Archives 0\.7 GiB$/);
    expect(machineHogs({ ...mini, consumers: [] })).toBe("");
  });
  it("datesBetween spans the week inclusive, across a month end", () => {
    expect(datesBetween("2026-08-28", "2026-09-03")).toEqual([
      "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
    ]);
    expect(datesBetween("2026-09-03", "2026-09-01")).toEqual([]);
  });
});

describe("isRowHigh", () => {
  const row = [10, 9, 5, 4, 6, 19];
  it("marks only the numeric high", () => {
    expect(row.map((_, i) => isRowHigh(row, i))).toEqual([false, false, false, false, false, true]);
  });
  it("marks every cell that ties for high", () => {
    expect(isRowHigh([4, 4], 0)).toBe(true);
    expect(isRowHigh([4, 4], 1)).toBe(true);
  });
  it("marks nothing on an unprocessed row", () => {
    expect(isRowHigh([null, undefined], 0)).toBe(false);
  });
});

describe("editionIndex", () => {
  it("interleaves newest-first with correct hrefs", () => {
    const out = editionIndex(["2026-07-02", "2026-06-30"], ["2026-07-01"]);
    expect(out).toEqual([
      { type: "daily", date: "2026-07-02", href: "/board/reports/2026-07-02" },
      { type: "weekly", date: "2026-07-01", href: "/board/reports/week/2026-07-01" },
      { type: "daily", date: "2026-06-30", href: "/board/reports/2026-06-30" },
    ]);
  });
  it("puts the weekly first on an equal date", () => {
    const out = editionIndex(["2026-06-29"], ["2026-06-29"]);
    expect(out.map((e) => e.type)).toEqual(["weekly", "daily"]);
  });
});

describe("shippedByDay", () => {
  const week = ["2026-07-19", "2026-07-20"];
  const card = (id: string, over: Partial<{ col: string; movedAt: string; doneAt: string }> = {}) =>
    ({ id, title: `card ${id}`, col: "done", ...over });

  it("files a card under the day it was marked done", () => {
    const out = shippedByDay([card("a", { doneAt: "2026-07-20T09:31:00Z" })], week);
    expect(out).toEqual({ "2026-07-20": [{ id: "a", title: "card a" }] });
  });

  it("falls back to the last column move when there is no doneAt", () => {
    const out = shippedByDay([card("a", { movedAt: "2026-07-19T22:00:00Z" })], week);
    expect(out["2026-07-19"]).toEqual([{ id: "a", title: "card a" }]);
  });

  it("prefers doneAt over movedAt when the two disagree", () => {
    const out = shippedByDay([card("a", { doneAt: "2026-07-19T08:00:00Z", movedAt: "2026-07-20T08:00:00Z" })], week);
    expect(Object.keys(out)).toEqual(["2026-07-19"]);
  });

  it("ignores cards that are not done, dated outside the week, or undated", () => {
    const out = shippedByDay(
      [
        card("open", { col: "inprogress", doneAt: "2026-07-20T09:00:00Z" }),
        card("earlier", { doneAt: "2026-07-04T09:00:00Z" }),
        card("undated"),
      ],
      week,
    );
    expect(out).toEqual({});
  });

  it("keeps every card of a day in the order given", () => {
    const out = shippedByDay(
      [card("a", { doneAt: "2026-07-20T09:00:00Z" }), card("b", { doneAt: "2026-07-20T18:00:00Z" })],
      week,
    );
    expect(out["2026-07-20"].map((c) => c.id)).toEqual(["a", "b"]);
  });
});
