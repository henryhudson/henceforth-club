import { describe, it, expect } from "vitest";
import {
  windowDates, parseSurvived, aggregateTotals, perApp, ratios,
  reflagSignature, reflagKey, recurringReflags, earliestDateIn, throughput, buildRetro,
} from "./whh-aggregate.mjs";

describe("windowDates", () => {
  it("returns the trailing N calendar days ending endDate, ascending", () => {
    expect(windowDates("2026-06-29", 7)).toEqual([
      "2026-06-23", "2026-06-24", "2026-06-25",
      "2026-06-26", "2026-06-27", "2026-06-28", "2026-06-29",
    ]);
  });
});

describe("parseSurvived", () => {
  it("reads n/m strings and tolerates junk", () => {
    expect(parseSurvived("10/10")).toEqual({ survived: 10, total: 10 });
    expect(parseSurvived("7/9")).toEqual({ survived: 7, total: 9 });
    expect(parseSurvived(undefined)).toEqual({ survived: 0, total: 0 });
  });
});

describe("aggregateTotals", () => {
  it("sums summary fields and accumulates survived n/m", () => {
    const reports = [
      { summary: { reviews: 3, confirmed: 3, rejected: 3, abstained: 1, alreadyResolved: 1, skipped: 1, newConfirmedDefects: 0, boardMoves: 1, verdictsSurvivedRefutation: "10/10" } },
      { summary: { reviews: 2, confirmed: 1, rejected: 2, abstained: 0, alreadyResolved: 0, skipped: 0, newConfirmedDefects: 1, boardMoves: 2, verdictsSurvivedRefutation: "5/6" } },
    ];
    const t = aggregateTotals(reports);
    expect(t.reviews).toBe(5);
    expect(t.confirmed).toBe(4);
    expect(t.boardMoves).toBe(3);
    expect(t.verdictsSurvived).toBe(15);
    expect(t.verdictsTotal).toBe(16);
  });
});

describe("perApp", () => {
  it("groups findings by app and counts verdicts", () => {
    const reports = [{ apps: [
      { app: "henceforth", name: "Henceforth", reviewFound: true, findings: [
        { verdict: "confirm" }, { verdict: "confirm" }, { verdict: "reject" }] },
      { app: "hansard", name: "Hansard", reviewFound: true, findings: [
        { verdict: "reject" }, { verdict: "abstain" }, { verdict: "already-resolved" }] },
    ] }];
    const a = perApp(reports);
    const h = a.find((x) => x.app === "henceforth");
    expect(h.confirm).toBe(2); expect(h.reject).toBe(1); expect(h.reviews).toBe(1);
  });
});

describe("ratios", () => {
  it("derives safely on zero denominators", () => {
    const r = ratios({ confirmed: 4, rejected: 0, abstained: 1, verdictsSurvived: 15, verdictsTotal: 16 });
    expect(r.confirmRejectRatio).toBeNull();
    expect(r.survivedRefutation).toBeCloseTo(15 / 16);
  });
});

describe("recurringReflags", () => {
  it("reflagSignature strips ordinals, parentheticals, and punctuation", () => {
    expect(reflagSignature("Timeline nil-billId id collision — 8th re-flag"))
      .toBe("timeline nil billid id collision");
  });

  it("reflagKey anchors on the first Swift file cited (title or evidence), else the title", () => {
    expect(reflagKey({ title: "TimelineModels.swift:31 — nil-billId collide", evidence: "" })).toBe("timelinemodels.swift");
    expect(reflagKey({ title: "Timeline nil-billId collision", evidence: "origin/main TimelineModels.swift:31 id = ..." })).toBe("timelinemodels.swift");
    expect(reflagKey({ title: "Some prose finding", evidence: "no file cited here" })).toBe("some prose finding");
  });

  it("collapses a finding re-derived across days under varying titles into ONE group", () => {
    const day = (date, title, evidence, rec = "") => ({ date, apps: [{ app: "hansard", findings: [{ title, evidence, verdict: "reject", recommendation: rec }] }] });
    const reports = [
      day("2026-06-23", 'Timeline nil-billId id collision ("bill--1")', "origin/main TimelineModels.swift:31 id = bill-..."),
      day("2026-06-24", "Timeline nil-billId id collision (bill--1)", "TimelineModels.swift:31 feeds recentBills..."),
      day("2026-06-27", "TimelineModels.swift:31 — nil-billId bills collide on identifiable id 'bill--1' in list (defect, 5th re-flag)", "TimelineModels.swift:31"),
      day("2026-06-28", "TimelineModels.swift:31/:74 — nil-billId bills collide (filed as defect, 7th re-flag)", "TimelineModels.swift:31"),
      day("2026-06-29", 'Timeline nil-billId id collision ("bill--1") — 8th re-flag', 'TimelineModels.swift:31 id = "bill-\\(bill.billId ?? -1)"', "Reject (8th dismissal)"),
    ];
    const out = recurringReflags(reports);
    expect(out).toHaveLength(1);
    expect(out[0].app).toBe("hansard");
    expect(out[0].signature).toBe("timelinemodels.swift");
    expect(out[0].timesFlagged).toBe(8);
    expect(out[0].status).toBe("serially-rejected");
    expect(out[0].firstSeen).toBe("2026-06-23");
  });

  it("groups by normalized title when no Swift file is cited", () => {
    const mk = (date, title, verdict, rec = "") => ({ date, apps: [{ app: "hansard", findings: [{ title, verdict, recommendation: rec }] }] });
    const reports = [
      mk("2026-06-27", "nil-billId collision — 6th re-flag", "reject"),
      mk("2026-06-28", "nil-billId collision — 7th re-flag", "reject"),
      mk("2026-06-29", "nil-billId collision — 8th re-flag", "reject", "Reject (8th dismissal)"),
    ];
    const out = recurringReflags(reports);
    expect(out).toHaveLength(1);
    expect(out[0].timesFlagged).toBe(8);
    expect(out[0].status).toBe("serially-rejected");
    expect(out[0].firstSeen).toBe("2026-06-27");
  });
});

describe("throughput + buildRetro", () => {
  it("earliestDateIn finds the earliest ISO date in free text", () => {
    expect(earliestDateIn("surfaced 2026-06-27 (carry-forward 2026-06-22)")).toBe("2026-06-22");
    expect(earliestDateIn("no date here")).toBeNull();
  });
  it("throughput censuses columns and flags pre-window stuck cards", () => {
    const board = { cards: [
      { id: "a", col: "done", apps: ["deck"], title: "A" },
      { id: "find-x-2026-06-10", col: "review", apps: ["henceforth"], title: "X", source: "2026-06-10" },
      { id: "y", col: "inprogress", apps: ["hansard"], title: "Y", desc: "started 2026-06-28" },
    ] };
    const t = throughput(board, "2026-06-23");
    expect(t.doneCount).toBe(1);
    expect(t.stuck.map((s) => s.id)).toEqual(["find-x-2026-06-10"]);
  });
  it("buildRetro assembles numbers and leaves judgement empty", () => {
    const reports = [{ date: "2026-06-29", summary: { reviews: 3, confirmed: 3, rejected: 3, abstained: 1, alreadyResolved: 1, skipped: 1, newConfirmedDefects: 0, boardMoves: 1, verdictsSurvivedRefutation: "10/10" }, apps: [] }];
    const retro = buildRetro({ reports, board: { cards: [] }, windowStart: "2026-06-23" });
    expect(retro.totals.reviews).toBe(3);
    expect(retro.wins).toEqual([]);
    expect(retro.misses).toEqual([]);
    expect(retro.nextWeek).toEqual([]);
  });
});
