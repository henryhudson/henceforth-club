import { describe, it, expect } from "vitest";
import {
  windowDates, parseSurvived, aggregateTotals, perApp, ratios,
  reflagSignature, recurringReflags, earliestDateIn, throughput, buildRetro,
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
  it("reflagSignature strips re-flag ordinals, dates, and 'already carded'", () => {
    expect(reflagSignature("Timeline nil-billId id collision — 8th re-flag"))
      .toBe("timeline nil-billid id collision");
  });
  it("groups a finding seen across days and reads its ordinal", () => {
    const mk = (date, title, verdict, rec = "") => ({ date, apps: [{ app: "hansard", findings: [{ title, verdict, recommendation: rec }] }] });
    const reports = [
      mk("2026-06-27", "nil-billId collision — 6th re-flag", "reject"),
      mk("2026-06-28", "nil-billId collision — 7th re-flag", "reject"),
      mk("2026-06-29", "nil-billId collision — 8th re-flag", "reject", "Reject (8th dismissal)"),
    ];
    const out = recurringReflags(reports);
    expect(out).toHaveLength(1);
    expect(out[0].app).toBe("hansard");
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
