import { describe, it, expect } from "vitest";
import type { Redis } from "@upstash/redis";
import { DEAL_MIX, PAIR_TOKEN_MINUTES, PROVISIONAL_DUELS } from "./constants";
import type { RatingTable } from "./elo";
import {
  consumePairToken,
  dealPair,
  issuePairToken,
  type DealCandidate,
  type DealtPairRecord,
} from "./dealer";

/** A tiny seeded generator — the dealer's randomness is a parameter, so every
 * one of these runs replays exactly. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function candidate(
  postId: string,
  author: string,
  priority = 0,
): DealCandidate {
  return { postId, author, priority };
}

/**
 * A pool the whole mix can deal from: four authors, six established texts,
 * six provisional, three carrying tip priority, every rating distinct so the
 * nearest-by-rating assertions have no ties.
 */
const AUTHORS = ["ann", "ben", "cara", "dev"] as const;
const POOL: readonly DealCandidate[] = Array.from({ length: 12 }, (_, i) =>
  candidate(`post-${i + 1}`, AUTHORS[i % AUTHORS.length], [2, 6, 9].includes(i) ? i + 1 : 0),
);
const TABLE: RatingTable = Object.fromEntries(
  POOL.map((c, i) => [
    c.postId,
    { rating: 1400 + i * 17, duels: i < 6 ? PROVISIONAL_DUELS + 10 : 3 },
  ]),
);

const ratingIn = (table: RatingTable, c: DealCandidate) =>
  table[c.postId]?.rating ?? 1500;
const duelsIn = (table: RatingTable, c: DealCandidate) =>
  table[c.postId]?.duels ?? 0;

/** The opponents a first pick may face: never itself, a different author
 * whenever one exists. Mirrors the dealer's stated eligibility rule. */
function eligibleOpponents(
  first: DealCandidate,
  pool: readonly DealCandidate[],
): DealCandidate[] {
  const others = pool.filter((c) => c.postId !== first.postId);
  const crossAuthor = others.filter((c) => c.author !== first.author);
  return crossAuthor.length > 0 ? crossAuthor : others;
}

function nearestOpponent(
  table: RatingTable,
  first: DealCandidate,
  pool: readonly DealCandidate[],
): DealCandidate {
  return eligibleOpponents(first, pool).reduce((best, c) =>
    Math.abs(ratingIn(table, c) - ratingIn(table, first)) <
    Math.abs(ratingIn(table, best) - ratingIn(table, first))
      ? c
      : best,
  );
}

describe("dealPair", () => {
  it("refuses to deal from fewer than two distinct texts", () => {
    const rng = seededRandom(1);
    expect(dealPair({}, [], rng)).toEqual({ kind: "insufficient" });
    expect(dealPair({}, [candidate("a", "ann")], rng)).toEqual({ kind: "insufficient" });
    // Two entries, one text — a duplicate is not an opponent.
    expect(
      dealPair({}, [candidate("a", "ann"), candidate("a", "ann")], rng),
    ).toEqual({ kind: "insufficient" });
  });

  it("never deals a text against itself or an author against themselves when alternatives exist", () => {
    const pool = [
      candidate("a", "xavier"),
      candidate("b", "xavier"),
      candidate("c", "yves"),
    ];
    const rng = seededRandom(2);
    for (let i = 0; i < 500; i++) {
      const result = dealPair({}, pool, rng);
      expect(result.kind).toBe("dealt");
      if (result.kind !== "dealt") continue;
      const [left, right] = result.pair;
      expect(left.postId).not.toBe(right.postId);
      expect(left.author).not.toBe(right.author);
    }
  });

  it("deals a same-author pair only when no cross-author pair exists", () => {
    const pool = [candidate("a", "xavier"), candidate("b", "xavier")];
    const result = dealPair({}, pool, seededRandom(3));
    expect(result.kind).toBe("dealt");
    if (result.kind !== "dealt") return;
    expect(result.pair[0].author).toBe(result.pair[1].author);
    expect(result.pair[0].postId).not.toBe(result.pair[1].postId);
  });

  it("is deterministic under a seeded generator", () => {
    const run = () => {
      const rng = seededRandom(42);
      return Array.from({ length: 50 }, () => dealPair(TABLE, POOL, rng));
    };
    expect(run()).toEqual(run());
  });

  it("hits the 60/20/15/5 mix within tolerance over a seeded run", () => {
    const rng = seededRandom(20260718);
    const counts: Record<string, number> = {};
    const deals = 4000;
    for (let i = 0; i < deals; i++) {
      const result = dealPair(TABLE, POOL, rng);
      expect(result.kind).toBe("dealt");
      if (result.kind !== "dealt") continue;
      counts[result.bucket] = (counts[result.bucket] ?? 0) + 1;
    }
    for (const [bucket, share] of Object.entries(DEAL_MIX)) {
      expect(Math.abs((counts[bucket] ?? 0) / deals - share)).toBeLessThan(0.03);
    }
  });

  it("keeps every bucket's promise across a seeded run", () => {
    const rng = seededRandom(7);
    for (let i = 0; i < 2000; i++) {
      const result = dealPair(TABLE, POOL, rng);
      expect(result.kind).toBe("dealt");
      if (result.kind !== "dealt") continue;
      const [left, right] = result.pair;

      // Every deal, whatever the bucket: two texts, two authors.
      expect(left.postId).not.toBe(right.postId);
      expect(left.author).not.toBe(right.author);

      if (result.bucket === "provisionalVersusEstablished") {
        const duels = [duelsIn(TABLE, left), duelsIn(TABLE, right)].sort((a, b) => a - b);
        expect(duels[0]).toBeLessThan(PROVISIONAL_DUELS);
        expect(duels[1]).toBeGreaterThanOrEqual(PROVISIONAL_DUELS);
      }
      if (result.bucket === "tipPriority") {
        expect(Math.max(left.priority, right.priority)).toBeGreaterThan(0);
      }
      if (result.bucket === "ratingAdjacent") {
        // One member is the other's nearest eligible opponent by rating —
        // checked both ways because the pair's order is shuffled.
        const adjacency =
          nearestOpponent(TABLE, left, POOL).postId === right.postId ||
          nearestOpponent(TABLE, right, POOL).postId === left.postId;
        expect(adjacency).toBe(true);
      }
    }
  });

  it("degrades honestly: no provisional-versus-established deals from a one-sided pool", () => {
    // Everyone provisional — the placement bucket has nothing to place against.
    const rng = seededRandom(11);
    for (let i = 0; i < 300; i++) {
      const result = dealPair({}, POOL, rng);
      expect(result.kind === "dealt" && result.bucket).not.toBe(
        "provisionalVersusEstablished",
      );
    }
  });

  it("degrades honestly: no tip-priority deals when nothing is tipped", () => {
    const untipped = POOL.map((c) => ({ ...c, priority: 0 }));
    const rng = seededRandom(13);
    for (let i = 0; i < 300; i++) {
      const result = dealPair(TABLE, untipped, rng);
      expect(result.kind === "dealt" && result.bucket).not.toBe("tipPriority");
    }
  });
});

/** A minimal in-memory stand-in for the Upstash client — only the calls the
 * token half makes: `set` with `nx`/`ex` and the atomic `getdel`. Expiry is
 * driven by a clock the test advances, so the ten-minute window is exact. */
function fakeRedis(clock: { now: number }): Redis {
  const store = new Map<string, { raw: string; expiresAt: number }>();
  const live = (entry: { expiresAt: number }) => entry.expiresAt > clock.now;
  return {
    set: async (
      key: string,
      value: unknown,
      opts?: { nx?: boolean; ex?: number },
    ) => {
      const existing = store.get(key);
      if (opts?.nx && existing && live(existing)) return null;
      store.set(key, {
        raw: JSON.stringify(value),
        expiresAt: clock.now + (opts?.ex ?? Number.MAX_SAFE_INTEGER) * 1000,
      });
      return "OK";
    },
    getdel: async <T,>(key: string) => {
      const entry = store.get(key);
      store.delete(key);
      return entry !== undefined && live(entry) ? (JSON.parse(entry.raw) as T) : null;
    },
  } as unknown as Redis;
}

const RECORD: DealtPairRecord = {
  profile: "alice",
  a: { postId: "post-1", author: "ben" },
  b: { postId: "post-2", author: "cara" },
};

describe("pair tokens", () => {
  it("issues a token and consumes it exactly once", async () => {
    const redis = fakeRedis({ now: 0 });

    const issued = await issuePairToken(RECORD, "token-1", redis);
    expect(issued).toEqual({ kind: "issued", token: "token-1" });

    expect(await consumePairToken("token-1", "alice", redis)).toEqual({
      kind: "consumed",
      pair: RECORD,
    });
    // Single use: the same token never resolves a second duel.
    expect(await consumePairToken("token-1", "alice", redis)).toEqual({
      kind: "refused",
    });
  });

  it("generates a token when none is supplied", async () => {
    const redis = fakeRedis({ now: 0 });
    const issued = await issuePairToken(RECORD, undefined, redis);
    expect(issued.kind).toBe("issued");
    if (issued.kind !== "issued") return;
    expect(issued.token.length).toBeGreaterThan(0);
    expect((await consumePairToken(issued.token, "alice", redis)).kind).toBe("consumed");
  });

  it("refuses a token it never issued", async () => {
    const redis = fakeRedis({ now: 0 });
    expect(await consumePairToken("forged", "alice", redis)).toEqual({ kind: "refused" });
  });

  it("expires after exactly ten minutes", async () => {
    const clock = { now: 0 };
    const redis = fakeRedis(clock);
    await issuePairToken(RECORD, "stale", redis);
    await issuePairToken(RECORD, "fresh", redis);

    clock.now = PAIR_TOKEN_MINUTES * 60 * 1000 - 1;
    expect((await consumePairToken("fresh", "alice", redis)).kind).toBe("consumed");

    clock.now = PAIR_TOKEN_MINUTES * 60 * 1000;
    expect(await consumePairToken("stale", "alice", redis)).toEqual({ kind: "refused" });
  });

  it("is bound to its bearer: another profile is refused and the token burns", async () => {
    const redis = fakeRedis({ now: 0 });
    await issuePairToken(RECORD, "token-1", redis);

    expect(await consumePairToken("token-1", "mallory", redis)).toEqual({
      kind: "mismatch",
    });
    // The probe burned the token — single use holds even under attack.
    expect(await consumePairToken("token-1", "alice", redis)).toEqual({
      kind: "refused",
    });
  });

  it("matches the bearer case-insensitively, like every folklore key", async () => {
    const redis = fakeRedis({ now: 0 });
    await issuePairToken({ ...RECORD, profile: "Alice" }, "token-1", redis);
    expect((await consumePairToken("token-1", "alice", redis)).kind).toBe("consumed");
  });

  it("never overwrites a live token: a colliding issue is refused and the original survives", async () => {
    const redis = fakeRedis({ now: 0 });
    await issuePairToken(RECORD, "token-1", redis);

    const hijack = await issuePairToken(
      { ...RECORD, profile: "mallory" },
      "token-1",
      redis,
    );

    expect(hijack).toEqual({ kind: "collision" });
    expect(await consumePairToken("token-1", "alice", redis)).toEqual({
      kind: "consumed",
      pair: RECORD,
    });
  });

  it("is null-Redis safe: unavailable on both sides", async () => {
    expect(await issuePairToken(RECORD, "token-1", null)).toEqual({ kind: "unavailable" });
    expect(await consumePairToken("token-1", "alice", null)).toEqual({ kind: "unavailable" });
  });
});
