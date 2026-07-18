import { describe, it, expect } from "vitest";
import {
  applyDuel,
  authorRatings,
  expectedScore,
  foldDuels,
  kFor,
  ratingOf,
  type Checkpoint,
  type DuelEntry,
  type RatingTable,
} from "./elo";
import {
  ELO_START,
  K_ESTABLISHED,
  K_PROVISIONAL,
  PROVISIONAL_DUELS,
} from "./constants";

function duel(seq: number, winnerPostId: string, loserPostId: string): DuelEntry {
  return {
    seq,
    duelId: `duel-${seq}`,
    winnerPostId,
    loserPostId,
    day: "2026-07-18",
  };
}

describe("expectedScore", () => {
  it("gives even odds to equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
  });

  it("sums to one across the two sides of any duel", () => {
    expect(expectedScore(1620, 1480) + expectedScore(1480, 1620)).toBeCloseTo(1, 12);
  });

  it("gives a 400-point favourite ten-to-one odds — the Elo scale's defining ratio", () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11, 12);
  });
});

describe("kFor — the K schedule", () => {
  it("is provisional (K=40) below twenty duels and established (K=16) from twenty on", () => {
    expect(kFor(0)).toBe(K_PROVISIONAL);
    expect(kFor(PROVISIONAL_DUELS - 1)).toBe(K_PROVISIONAL);
    expect(kFor(PROVISIONAL_DUELS)).toBe(K_ESTABLISHED);
  });
});

describe("applyDuel", () => {
  it("moves two fresh texts by twenty points each — even odds at K=40", () => {
    const table = applyDuel({}, duel(1, "winner", "loser"));
    expect(table).toEqual({
      winner: { rating: ELO_START + 20, duels: 1 },
      loser: { rating: ELO_START - 20, duels: 1 },
    });
  });

  it("uses each side's own K: an established winner gains 8 while a provisional loser drops 20", () => {
    const start: RatingTable = {
      veteran: { rating: ELO_START, duels: PROVISIONAL_DUELS },
    };
    const table = applyDuel(start, duel(1, "veteran", "novice"));
    expect(ratingOf(table, "veteran")).toEqual({
      rating: ELO_START + K_ESTABLISHED * 0.5,
      duels: PROVISIONAL_DUELS + 1,
    });
    expect(ratingOf(table, "novice")).toEqual({
      rating: ELO_START - K_PROVISIONAL * 0.5,
      duels: 1,
    });
  });

  it("never mutates the table it was given", () => {
    const start: RatingTable = { a: { rating: 1600, duels: 3 } };
    applyDuel(start, duel(1, "a", "b"));
    expect(start).toEqual({ a: { rating: 1600, duels: 3 } });
  });

  it("folds a self-duel as a no-op — a hand-written entry must not corrupt the table", () => {
    const start: RatingTable = { a: { rating: 1600, duels: 3 } };
    expect(applyDuel(start, duel(1, "a", "a"))).toEqual(start);
  });
});

describe("ratingOf", () => {
  it("reads an unseen text as unrated at the starting rating", () => {
    expect(ratingOf({}, "never-dueled")).toEqual({ rating: ELO_START, duels: 0 });
  });
});

describe("foldDuels", () => {
  const ledger = [
    duel(1, "a", "b"),
    duel(2, "c", "a"),
    duel(3, "b", "c"),
    duel(4, "a", "c"),
    duel(5, "d", "b"),
    duel(6, "a", "d"),
    duel(7, "c", "d"),
  ];

  it("folds an empty ledger to an empty table", () => {
    expect(foldDuels([])).toEqual({});
  });

  it("is deterministic: the same ledger always folds to the same table", () => {
    expect(foldDuels(ledger)).toEqual(foldDuels(ledger));
  });

  it("does not commute: ledger order matters, and the order's outcome is pinned", () => {
    const forward = [duel(1, "a", "b"), duel(2, "c", "a")];
    const reversed = [duel(1, "c", "a"), duel(2, "a", "b")];
    expect(foldDuels(forward)).not.toEqual(foldDuels(reversed));

    // Pin the forward outcome by hand: a beats b (even odds, +20/−20), then c
    // beats the now-1520 a — the favourite's expected score is
    // 1/(1 + 10^(20/400)) ≈ 0.52875, so c takes 40 × 0.52875 ≈ 21.15 from a.
    const table = foldDuels(forward);
    expect(ratingOf(table, "a").rating).toBeCloseTo(1498.85, 2);
    expect(ratingOf(table, "b").rating).toBeCloseTo(1480, 2);
    expect(ratingOf(table, "c").rating).toBeCloseTo(1521.15, 2);
  });

  it("switches K at exactly duel twenty: the twentieth win moves at 40, the twenty-first at 16", () => {
    const wins = Array.from({ length: PROVISIONAL_DUELS + 1 }, (_, i) =>
      duel(i + 1, "hero", `opponent-${i + 1}`),
    );
    const before = foldDuels(wins.slice(0, PROVISIONAL_DUELS - 1));
    const atTwenty = foldDuels(wins.slice(0, PROVISIONAL_DUELS));
    const atTwentyOne = foldDuels(wins);

    const twentiethDelta =
      ratingOf(atTwenty, "hero").rating - ratingOf(before, "hero").rating;
    expect(twentiethDelta).toBeCloseTo(
      K_PROVISIONAL * (1 - expectedScore(ratingOf(before, "hero").rating, ELO_START)),
      9,
    );

    const twentyFirstDelta =
      ratingOf(atTwentyOne, "hero").rating - ratingOf(atTwenty, "hero").rating;
    expect(twentyFirstDelta).toBeCloseTo(
      K_ESTABLISHED * (1 - expectedScore(ratingOf(atTwenty, "hero").rating, ELO_START)),
      9,
    );
    expect(ratingOf(atTwentyOne, "hero").duels).toBe(PROVISIONAL_DUELS + 1);
  });

  it("a checkpointed fold equals the full fold, given the tail or the whole ledger", () => {
    const full = foldDuels(ledger);
    const checkpoint: Checkpoint = { seq: 4, table: foldDuels(ledger.slice(0, 4)) };
    expect(foldDuels(ledger.slice(4), checkpoint)).toEqual(full);
    expect(foldDuels(ledger, checkpoint)).toEqual(full);
  });

  it("never mutates the checkpoint it resumes from — a checkpoint is a cache", () => {
    const checkpoint: Checkpoint = { seq: 4, table: foldDuels(ledger.slice(0, 4)) };
    const snapshot = structuredClone(checkpoint);
    foldDuels(ledger, checkpoint);
    expect(checkpoint).toEqual(snapshot);
  });
});

describe("authorRatings", () => {
  const rated = (rating: number): { rating: number; duels: number } => ({
    rating,
    duels: PROVISIONAL_DUELS,
  });

  it("takes the mean of the author's top five rated texts", () => {
    const table: RatingTable = {
      p1: rated(1600),
      p2: rated(1580),
      p3: rated(1560),
      p4: rated(1540),
      p5: rated(1520),
      p6: rated(1400),
      p7: rated(1300),
    };
    const authors = { alice: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"] };
    expect(authorRatings(table, authors)).toEqual({ alice: 1560 });
  });

  it("averages what exists when an author has fewer than five rated texts", () => {
    const table: RatingTable = { p1: rated(1600), p2: rated(1500) };
    expect(authorRatings(table, { alice: ["p1", "p2"] })).toEqual({ alice: 1550 });
  });

  it("rewards peaks, not flooding: a pile of weak texts cannot dilute a strong top five", () => {
    const strongFive = ["s1", "s2", "s3", "s4", "s5"];
    const table: RatingTable = Object.fromEntries([
      ...strongFive.map((id) => [id, rated(1600)]),
      ...Array.from({ length: 10 }, (_, i) => [`weak-${i}`, rated(1450)]),
    ]);
    const focused = authorRatings(table, { alice: strongFive });
    const flooded = authorRatings(table, {
      alice: [...strongFive, ...Array.from({ length: 10 }, (_, i) => `weak-${i}`)],
    });
    expect(flooded).toEqual(focused);
  });

  it("ignores texts that have never dueled and omits authors with none rated", () => {
    const table: RatingTable = { p1: rated(1520) };
    const result = authorRatings(table, {
      alice: ["p1", "never-dueled"],
      bob: ["also-never-dueled"],
    });
    expect(result).toEqual({ alice: 1520 });
  });
});
