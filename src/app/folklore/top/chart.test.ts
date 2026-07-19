import { describe, expect, it } from "vitest";
import { buildChart, chartDay, nextDay, previousDay, rootOf } from "./chart";

const TODAY = "2026-07-19";

describe("chartDay — which day the chart shows", () => {
  it("keeps a well-formed past day", () => {
    expect(chartDay("2026-07-01", TODAY)).toBe("2026-07-01");
  });

  it("shows today by default", () => {
    expect(chartDay(undefined, TODAY)).toBe(TODAY);
    expect(chartDay(TODAY, TODAY)).toBe(TODAY);
  });

  it("falls back to today on a malformed or impossible day", () => {
    for (const bad of ["junk", "20260701", "2026-7-1", "2026-13-01", "2026-02-31", ""]) {
      expect(chartDay(bad, TODAY)).toBe(TODAY);
    }
  });

  it("clamps a future day to today — tomorrow has no chart yet", () => {
    expect(chartDay("2026-07-20", TODAY)).toBe(TODAY);
    expect(chartDay("2027-01-01", TODAY)).toBe(TODAY);
  });
});

describe("previousDay / nextDay — the chart's navigation", () => {
  it("steps a calendar day either way", () => {
    expect(previousDay("2026-07-19")).toBe("2026-07-18");
    expect(nextDay("2026-07-18")).toBe("2026-07-19");
  });

  it("holds the day boundary across months and leap years", () => {
    expect(previousDay("2026-07-01")).toBe("2026-06-30");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
    expect(nextDay("2024-02-28")).toBe("2024-02-29");
    expect(nextDay("2024-02-29")).toBe("2024-03-01");
  });

  it("inverts: next of previous is the day itself", () => {
    expect(nextDay(previousDay("2026-07-19"))).toBe("2026-07-19");
  });
});

describe("rootOf — the thread root a kudos rolls up to", () => {
  const parents = new Map([
    ["p3", "p2"],
    ["p2", "p1"],
  ]);

  it("is the post itself when nothing is above it", () => {
    expect(rootOf("p1", parents)).toBe("p1");
    expect(rootOf("lonely", parents)).toBe("lonely");
  });

  it("walks a self-reply chain to its top", () => {
    expect(rootOf("p3", parents)).toBe("p1");
    expect(rootOf("p2", parents)).toBe("p1");
  });

  it("terminates on a cyclic parent map instead of hanging", () => {
    const cycle = new Map([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(rootOf("a", cycle)).toBe("b");
  });
});

describe("buildChart — the day's ranking", () => {
  const parents = new Map([
    ["p2", "p1"],
    ["p3", "p1"],
  ]);

  it("is empty on an empty day", () => {
    expect(buildChart([], parents)).toEqual([]);
  });

  it("rolls a continuation post's kudos up to its thread root — one unit, one total", () => {
    const chart = buildChart(
      [
        { postId: "p2", author: "ann", amount: 5 },
        { postId: "p1", author: "ann", amount: 3 },
      ],
      parents,
    );
    expect(chart).toEqual([
      {
        rootPostId: "p1",
        author: "ann",
        total: 8,
        rootAmount: 3,
        continuations: [{ postId: "p2", amount: 5 }],
      },
    ]);
  });

  it("charts a thread whose root received nothing itself", () => {
    const chart = buildChart([{ postId: "p3", author: "ann", amount: 4 }], parents);
    expect(chart).toEqual([
      {
        rootPostId: "p1",
        author: "ann",
        total: 4,
        rootAmount: 0,
        continuations: [{ postId: "p3", amount: 4 }],
      },
    ]);
  });

  it("sums repeat kudos on one post and orders continuations largest first", () => {
    const chart = buildChart(
      [
        { postId: "p2", author: "ann", amount: 1 },
        { postId: "p3", author: "ann", amount: 6 },
        { postId: "p2", author: "ann", amount: 2 },
      ],
      parents,
    );
    expect(chart[0].continuations).toEqual([
      { postId: "p3", amount: 6 },
      { postId: "p2", amount: 3 },
    ]);
    expect(chart[0].total).toBe(9);
  });

  it("ranks units by the day's total, deterministically on a tie", () => {
    const chart = buildChart(
      [
        { postId: "solo-b", author: "ben", amount: 2 },
        { postId: "solo-c", author: "cat", amount: 7 },
        { postId: "solo-a", author: "ann", amount: 2 },
      ],
      new Map(),
    );
    expect(chart.map((unit) => unit.rootPostId)).toEqual(["solo-c", "solo-a", "solo-b"]);
  });
});
