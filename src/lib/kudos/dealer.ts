import type { Redis } from "@upstash/redis";
import { getRedis } from "../redis";
import { DEAL_MIX, PAIR_TOKEN_MINUTES, PROVISIONAL_DUELS } from "./constants";
import { ratingOf, type RatingTable } from "./elo";

// The dealer — pairs are server-dealt, never chosen, which is the whole
// anti-gaming stance: a matchup a voter cannot construct is a matchup a
// voter cannot pump. Two halves:
//
//   dealPair          pure — table, candidates and randomness in, a pair
//                     out; the 60/20/15/5 mix from DEAL_MIX
//   pair tokens       the Redis edge — a dealt pair is only resolvable
//                     with its single-use, ten-minute token, bound to the
//                     bearer it was dealt to
//
// The rng parameter is the only randomness and the token store is the only
// state; everything else is a fold over its arguments, like elo.ts.

/** A text the dealer may put on the table. `priority` is the decaying
 * tip-priority bump — zero when untipped. */
export type DealCandidate = {
  postId: string;
  author: string;
  priority: number;
};

export type DealBucket = keyof typeof DEAL_MIX;

export type DealResult =
  | { kind: "dealt"; pair: readonly [DealCandidate, DealCandidate]; bucket: DealBucket }
  | { kind: "insufficient" };

/** Uniform pick; the clamp keeps a generator that returns exactly 1 in
 * bounds. Callers guarantee a non-empty list. */
function uniformPick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** Pick weighted by `weightOf` — the tip-priority draw: a bigger bump buys
 * proportionally more exposure. */
function weightedPick<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  rng: () => number,
): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  const roll = rng() * total;
  let cumulative = 0;
  for (const item of items) {
    cumulative += weightOf(item);
    if (roll < cumulative) return item;
  }
  return items[items.length - 1];
}

/** The opponents a first pick may face: never itself, and a different
 * author whenever one exists — a same-author pair is dealt only when the
 * pool offers nothing else. */
function eligibleOpponents(
  first: DealCandidate,
  pool: readonly DealCandidate[],
): DealCandidate[] {
  const others = pool.filter((c) => c.postId !== first.postId);
  const crossAuthor = others.filter((c) => c.author !== first.author);
  return crossAuthor.length > 0 ? crossAuthor : others;
}

/** Of a restricted first-pick pool, prefer the picks that can face a
 * different author — so a cross-author pair is dealt whenever one exists,
 * whichever side the bucket draws first. */
function preferViableFirsts(
  firsts: readonly DealCandidate[],
  opponents: readonly DealCandidate[],
): readonly DealCandidate[] {
  const viable = firsts.filter((f) =>
    opponents.some((c) => c.postId !== f.postId && c.author !== f.author),
  );
  return viable.length > 0 ? viable : firsts;
}

/** The nearest eligible opponent by rating — the informative duel. Ties
 * keep the earliest candidate, so the choice is deterministic. */
function nearestByRating(
  table: RatingTable,
  first: DealCandidate,
  opponents: readonly DealCandidate[],
): DealCandidate {
  const target = ratingOf(table, first.postId).rating;
  return opponents.reduce((best, c) =>
    Math.abs(ratingOf(table, c.postId).rating - target) <
    Math.abs(ratingOf(table, best.postId).rating - target)
      ? c
      : best,
  );
}

/** One roll of the mix: 60% rating-adjacent, 20% provisional-versus-
 * established, 15% tip-priority, 5% uniform random. */
function chooseBucket(roll: number): DealBucket {
  const adjacent = DEAL_MIX.ratingAdjacent;
  const placement = adjacent + DEAL_MIX.provisionalVersusEstablished;
  const tipped = placement + DEAL_MIX.tipPriority;
  if (roll < adjacent) return "ratingAdjacent";
  if (roll < placement) return "provisionalVersusEstablished";
  if (roll < tipped) return "tipPriority";
  return "uniformRandom";
}

/** Deal within a bucket. A bucket whose precondition the pool cannot meet
 * (no established texts to place against, nothing tipped) degrades to a
 * bucket that can deal — and reports the bucket that actually dealt, so
 * the mix is never overstated. */
function dealFor(
  bucket: DealBucket,
  table: RatingTable,
  candidates: readonly DealCandidate[],
  rng: () => number,
): { first: DealCandidate; opponent: DealCandidate; bucket: DealBucket } {
  switch (bucket) {
    case "provisionalVersusEstablished": {
      const provisional = candidates.filter(
        (c) => ratingOf(table, c.postId).duels < PROVISIONAL_DUELS,
      );
      const established = candidates.filter(
        (c) => ratingOf(table, c.postId).duels >= PROVISIONAL_DUELS,
      );
      if (provisional.length === 0 || established.length === 0) {
        return dealFor("ratingAdjacent", table, candidates, rng);
      }
      const first = uniformPick(preferViableFirsts(provisional, established), rng);
      const opponent = uniformPick(eligibleOpponents(first, established), rng);
      return { first, opponent, bucket };
    }
    case "tipPriority": {
      const tipped = candidates.filter((c) => c.priority > 0);
      if (tipped.length === 0) {
        return dealFor("ratingAdjacent", table, candidates, rng);
      }
      // Tips buy exposure, never rank: the tipped text is dealt against its
      // rating peer and must win on merit.
      const first = weightedPick(
        preferViableFirsts(tipped, candidates),
        (c) => c.priority,
        rng,
      );
      const opponent = nearestByRating(table, first, eligibleOpponents(first, candidates));
      return { first, opponent, bucket };
    }
    case "uniformRandom": {
      const first = uniformPick(candidates, rng);
      const opponent = uniformPick(eligibleOpponents(first, candidates), rng);
      return { first, opponent, bucket };
    }
    case "ratingAdjacent": {
      const first = uniformPick(candidates, rng);
      const opponent = nearestByRating(table, first, eligibleOpponents(first, candidates));
      return { first, opponent, bucket };
    }
  }
}

/**
 * Deal a pair for the arena. Pure: the table and candidates are read, the
 * generator (values in [0, 1)) is the only randomness. A pool without two
 * distinct texts cannot duel — `insufficient`. The dealt pair's order is
 * shuffled so no bucket's draw always sits on top of the stack.
 */
export function dealPair(
  table: RatingTable,
  candidates: readonly DealCandidate[],
  rng: () => number,
): DealResult {
  const distinctPosts = new Set(candidates.map((c) => c.postId));
  if (distinctPosts.size < 2) return { kind: "insufficient" };
  const { first, opponent, bucket } = dealFor(chooseBucket(rng()), table, candidates, rng);
  const pair: readonly [DealCandidate, DealCandidate] =
    rng() < 0.5 ? [first, opponent] : [opponent, first];
  return { kind: "dealt", pair, bucket };
}

// ── Dealt-pair tokens ────────────────────────────────────────────────────
//
// A duel resolution is valid only with the dealer's token: single use,
// PAIR_TOKEN_MINUTES expiry, bound to the profile it was dealt to. Keys:
//
//   kudos:pair:<token>   the dealt pair record, SET NX EX
//
// NX means a live token is never overwritten — a colliding issue cannot
// swap the pair from under a voter. Consumption is one atomic GETDEL, so a
// token resolves at most one duel however many requests race for it.

const pairTokenKey = (token: string) => `kudos:pair:${token}`;

/** One side of a dealt pair, as resolution needs it: which text, and which
 * author earns the kudos if it wins. */
export type DealtSide = { postId: string; author: string };

/** What the token protects: the pair as dealt, and the profile it was
 * dealt to — the session binding. */
export type DealtPairRecord = {
  profile: string;
  a: DealtSide;
  b: DealtSide;
};

export type IssuePairTokenResult =
  | { kind: "issued"; token: string }
  | { kind: "collision" }
  | { kind: "unavailable" };

export type ConsumePairTokenResult =
  | { kind: "consumed"; pair: DealtPairRecord }
  | { kind: "refused" }
  | { kind: "mismatch" }
  | { kind: "unavailable" };

/**
 * Issue the token for a dealt pair — SET NX EX in one command: created only
 * if absent, expiring after PAIR_TOKEN_MINUTES. The token parameter exists
 * for tests; production callers take the generated one.
 */
export async function issuePairToken(
  record: DealtPairRecord,
  token: string = crypto.randomUUID(),
  redis: Redis | null = getRedis(),
): Promise<IssuePairTokenResult> {
  if (!redis) return { kind: "unavailable" };
  const stored = await redis.set(pairTokenKey(token), record, {
    nx: true,
    ex: PAIR_TOKEN_MINUTES * 60,
  });
  return stored === "OK" ? { kind: "issued", token } : { kind: "collision" };
}

/**
 * Consume a token and surrender its pair — the only door to a duel
 * resolution. One atomic GETDEL: missing, expired and already-used tokens
 * are indistinguishable and all `refused`. A live token presented by the
 * wrong bearer is `mismatch` — and is burned by the same GETDEL, so a
 * probing attacker spends the token without learning the pair's fate;
 * single use holds even under attack.
 */
export async function consumePairToken(
  token: string,
  profile: string,
  redis: Redis | null = getRedis(),
): Promise<ConsumePairTokenResult> {
  if (!redis) return { kind: "unavailable" };
  const record = await redis.getdel<DealtPairRecord>(pairTokenKey(token));
  if (record === null) return { kind: "refused" };
  if (record.profile.toLowerCase() !== profile.toLowerCase()) {
    return { kind: "mismatch" };
  }
  return { kind: "consumed", pair: record };
}
