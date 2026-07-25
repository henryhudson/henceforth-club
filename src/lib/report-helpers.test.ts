import { describe, expect, it } from "vitest";
import { asList, editionIndex, reachAppLine, shippedByDay, verdictLine } from "./report-helpers";

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
