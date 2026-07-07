import { describe, it, expect } from "vitest";
import {
  SCORE_HALF_LIFE_DAYS,
  decayWeight,
  foldScores,
  scoreEntries,
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

describe("SCORE_HALF_LIFE_DAYS", () => {
  it("is the one tuning constant: thirty days", () => {
    expect(SCORE_HALF_LIFE_DAYS).toBe(30);
  });
});

describe("decayWeight", () => {
  it("weighs a fresh vote fully", () => {
    expect(decayWeight(0)).toBe(1);
  });

  it("weighs a half-life-old vote at exactly half", () => {
    expect(decayWeight(SCORE_HALF_LIFE_DAYS)).toBe(0.5);
  });

  it("weighs a two-half-lives-old vote at a quarter", () => {
    expect(decayWeight(2 * SCORE_HALF_LIFE_DAYS)).toBe(0.25);
  });

  it("never weighs a vote more than fully, even for a day in the future of the fold", () => {
    expect(decayWeight(-5)).toBe(1);
  });
});

describe("foldScores", () => {
  it("folds an empty ledger to an empty table — every unseen post scores zero", () => {
    expect(foldScores([], "2026-07-01")).toEqual({});
  });

  it("counts a fresh vote at its full paid weight", () => {
    const ledger = [vote({ sats: 700, day: "2026-07-01" })];
    expect(foldScores(ledger, "2026-07-01")).toEqual({ "post-1": 700 });
  });

  it("counts a thirty-day-old vote at half weight", () => {
    const ledger = [vote({ sats: 1000, day: "2026-06-01" })];
    expect(foldScores(ledger, "2026-07-01")).toEqual({ "post-1": 500 });
  });

  it("subtracts a down vote's decayed satoshis", () => {
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

  it("accumulates votes on one post, each at its own decay", () => {
    const ledger = [
      vote({ txid: "a", sats: 1000, day: "2026-05-02" }), // 60 days ago -> 250
      vote({ txid: "b", sats: 1000, day: "2026-06-01" }), // 30 days ago -> 500
      vote({ txid: "c", sats: 1000, day: "2026-07-01" }), // fresh -> 1000
    ];
    expect(foldScores(ledger, "2026-07-01")).toEqual({ "post-1": 1750 });
  });

  it("flips the ordering as decay progresses: a newer, smaller vote overtakes a faded old one", () => {
    const oldGlory = vote({ txid: "a", postId: "old", sats: 1000, day: "2026-06-01" });
    const newcomer = vote({ txid: "b", postId: "new", sats: 600, day: "2026-07-11" });

    // While the old vote is fresh (and the newcomer's vote hasn't happened),
    // the old post leads.
    const before = foldScores([oldGlory], "2026-06-01");
    expect(before["old"]).toBeGreaterThan(before["new"] ?? 0);

    // Forty days on, the old vote has decayed below the newcomer's 600.
    const after = foldScores([oldGlory, newcomer], "2026-07-11");
    expect(after["new"]).toBeGreaterThan(after["old"]);
    expect(after["old"]).toBeCloseTo(1000 * 2 ** (-40 / 30), 6);
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

describe("scoreEntries", () => {
  it("derives the sorted-set cache entries from the fold, one per voted post", () => {
    const ledger = [
      vote({ txid: "a", postId: "p1", sats: 1000, day: "2026-07-01" }),
      vote({ txid: "b", postId: "p2", sats: 400, day: "2026-06-01", dir: "down" }),
    ];
    expect(scoreEntries(ledger, "2026-07-01")).toEqual([
      { member: "p1", score: 1000 },
      { member: "p2", score: -200 },
    ]);
  });

  it("derives no entries from an empty ledger", () => {
    expect(scoreEntries([], "2026-07-01")).toEqual([]);
  });
});
