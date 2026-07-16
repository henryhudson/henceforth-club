import { describe, it, expect } from "vitest";
import {
  foldScores,
  totalFoundingSats,
  windowStartDay,
  type VoteLedgerEntry,
} from "./xScore";

function vote(overrides: Partial<VoteLedgerEntry> = {}): VoteLedgerEntry {
  return {
    txid: overrides.txid ?? "tx-default",
    postId: overrides.postId ?? "post-1",
    dir: overrides.dir ?? "up",
    sats: overrides.sats ?? 1000,
    day: overrides.day ?? "2026-07-01",
    ...overrides,
  };
}

describe("totalFoundingSats", () => {
  it("sums only founding entries — votes are earnings, not archive spend", () => {
    const ledger = [
      vote({ txid: "insc:p1", postId: "p1", sats: 31942, day: "2026-07-12" }),
      { ...vote({ postId: "p2", sats: 18, day: "2026-07-01" }), founding: true },
      vote({ txid: "c".repeat(64), postId: "p1", sats: 5000, day: "2026-07-12" }), // a received vote
    ];
    expect(totalFoundingSats(ledger)).toBe(31942 + 18);
  });

  it("an empty ledger has cost nothing", () => {
    expect(totalFoundingSats([])).toBe(0);
  });
});

describe("foldScores", () => {
  it("a founding entry is the permanent floor: it never ages out of any window", () => {
    // The 2026-07-12 rule: upload cost is the initial score; votes add to it.
    const founding = vote({ txid: "insc-tx:p1", postId: "p1", sats: 31942, day: "2026-07-01" });
    // Eleven days later, the week window starts 2026-07-05 — the founding
    // cost must still be there, and only the windowed vote adds.
    const oldVote = vote({ txid: "a".repeat(64), postId: "p1", sats: 500, day: "2026-06-01" });
    const newVote = vote({ txid: "b".repeat(64), postId: "p1", sats: 900, day: "2026-07-11" });
    const table = foldScores([founding, oldVote, newVote], "2026-07-12", "2026-07-05");
    expect(table).toEqual({ p1: 31942 + 900 });
  });

  it("the explicit founding flag marks the floor even without the composite txid", () => {
    const flagged = { ...vote({ postId: "p2", sats: 100, day: "2020-01-01" }), founding: true };
    expect(foldScores([flagged], "2026-07-12", "2026-07-05")).toEqual({ p2: 100 });
  });

  it("folds an empty ledger to an empty table — every unseen post scores zero", () => {
    expect(foldScores([], "2026-07-01")).toEqual({});
  });

  it("counts a fresh vote at its full paid weight", () => {
    const ledger = [vote({ sats: 700, day: "2026-07-01" })];
    expect(foldScores(ledger, "2026-07-01")).toEqual({ "post-1": 700 });
  });

  it("subtracts a down vote's satoshis", () => {
    const ledger = [
      vote({ txid: "a", sats: 700, dir: "up", day: "2026-07-01" }),
      vote({ txid: "b", sats: 200, dir: "down", day: "2026-07-01" }),
    ];
    expect(foldScores(ledger, "2026-07-01")).toEqual({ "post-1": 500 });
  });

  it("lets a lone down vote drive a score negative", () => {
    const ledger = [vote({ dir: "down", sats: 300, day: "2026-07-01" })];
    expect(foldScores(ledger, "2026-07-01")).toEqual({ "post-1": -300 });
  });

  it("counts a future-dated vote fully, never more than fully", () => {
    const ledger = [vote({ sats: 400, day: "2026-07-05" })];
    expect(foldScores(ledger, "2026-07-01")).toEqual({ "post-1": 400 });
  });

  it("is deterministic: replaying the same ledger yields the same table", () => {
    const ledger = [
      vote({ txid: "a", sats: 1000, day: "2026-06-01" }),
      vote({ txid: "b", sats: 500, day: "2026-07-01", dir: "down" }),
    ];
    expect(foldScores(ledger, "2026-07-01")).toEqual(foldScores(ledger, "2026-07-01"));
  });

  it("ignores entry order: the fold is a sum, so any permutation gives the same table", () => {
    const entries = [
      vote({ txid: "a", sats: 1000, day: "2026-07-01" }),
      vote({ txid: "b", sats: 500, day: "2026-06-01" }),
      vote({ txid: "c", sats: 250, day: "2026-05-02", dir: "down" }),
    ];
    const reversed = [...entries].reverse();
    expect(foldScores(reversed, "2026-07-01")).toEqual(foldScores(entries, "2026-07-01"));
  });

  it("replays a removed entry away exactly: the corrected fold equals the state before it was appended", () => {
    const sound = [
      vote({ txid: "a", postId: "p1", sats: 1000, day: "2026-06-01" }),
      vote({ txid: "b", postId: "p2", sats: 300, day: "2026-07-01" }),
    ];
    const mistake = vote({ txid: "double-spent", postId: "p1", sats: 5000, day: "2026-07-01" });
    const full = [...sound, mistake];

    const prior = foldScores(sound, "2026-07-01");
    expect(foldScores(full, "2026-07-01")).not.toEqual(prior);

    const corrected = full.filter((e) => e.txid !== mistake.txid);
    expect(foldScores(corrected, "2026-07-01")).toEqual(prior);
  });

  it("lets an entry with an unreadable day contribute nothing rather than poison the table", () => {
    const ledger = [
      vote({ txid: "a", sats: 700, day: "2026-07-01" }),
      vote({ txid: "b", postId: "post-2", sats: 500, day: "not-a-date" }),
    ];
    expect(foldScores(ledger, "2026-07-01")).toEqual({ "post-1": 700 });
  });
});

describe("windowStartDay", () => {
  it("bounds week to seven days back", () =>
    expect(windowStartDay("week", "2026-07-10")).toBe("2026-07-03"));
  it("bounds day to one day back", () =>
    expect(windowStartDay("day", "2026-07-10")).toBe("2026-07-09"));
  it("bounds month to thirty days, year to 365", () => {
    expect(windowStartDay("month", "2026-07-31")).toBe("2026-07-01");
    expect(windowStartDay("year", "2026-07-10")).toBe("2025-07-10");
  });
  it("has no lower bound for all", () =>
    expect(windowStartDay("all", "2026-07-10")).toBeNull());
});

describe("foldScores windowing + no decay", () => {
  it("counts a vote at full weight regardless of age (decay removed)", () => {
    const ledger = [vote({ day: "2026-01-01", sats: 1000 })]; // ~190 days old
    expect(foldScores(ledger, "2026-07-10", null)["post-1"]).toBe(1000);
  });
  it("excludes entries before the window start, includes those on it", () => {
    const ledger = [
      vote({ txid: "a", day: "2026-07-02", sats: 500 }), // before week start
      vote({ txid: "b", day: "2026-07-03", sats: 700 }), // exactly on start
    ];
    const start = windowStartDay("week", "2026-07-10");
    expect(foldScores(ledger, "2026-07-10", start)["post-1"]).toBe(700);
  });
  it("sums signed across up and down inside the window", () => {
    const ledger = [
      vote({ txid: "a", dir: "up", sats: 1000, day: "2026-07-09" }),
      vote({ txid: "b", dir: "down", sats: 300, day: "2026-07-09" }),
    ];
    expect(foldScores(ledger, "2026-07-10", null)["post-1"]).toBe(700);
  });
});
