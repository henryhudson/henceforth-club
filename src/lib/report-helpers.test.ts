import { afterEach, describe, expect, it } from "vitest";
import { asList, editionIndex, editionNumber, longDate, reachAppLine, shippedByDay, verdictLine } from "./report-helpers";

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
