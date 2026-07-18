import type { Redis } from "@upstash/redis";
import { getRedis } from "../redis";
import { foldDuels, type Checkpoint, type DuelEntry, type RatingTable } from "./elo";

// The Redis edge of the duel ledger — thin on purpose; all rating logic lives
// in elo.ts. Three keys per the design:
//
//   kudos:duels            global append-only duel ledger, oldest first
//   kudos:duels:seq        monotone sequence counter — never rewinds, even
//                          when a struck entry leaves a gap
//   kudos:fold:checkpoint  ratings as of a sequence — a cache, never truth
//
// Reads fold the checkpoint plus the tail after it; a correction
// (strikeDuels) removes ledger entries and drops the checkpoint, so the next
// read is a replay of what remains — never a patch to a cached number.
// Null-Redis safe like xVotes.ts.

const DUELS_KEY = "kudos:duels";
const SEQ_KEY = "kudos:duels:seq";
const CHECKPOINT_KEY = "kudos:fold:checkpoint";

export type AppendDuelResult =
  | { kind: "recorded"; entry: DuelEntry }
  | { kind: "unavailable" };

export type WriteCheckpointResult = "written" | "unavailable";

export type StrikeDuelsResult =
  | { kind: "struck"; struck: string[]; missing: string[] }
  | { kind: "unavailable" };

/**
 * Append a resolved duel; the ledger assigns the next monotone seq. The
 * counter is claimed before the push: if the push then fails the seq is a
 * gap, never a duplicate — read-since tolerates gaps, it could not tolerate
 * two entries at one seq.
 */
export async function appendDuel(
  duel: Omit<DuelEntry, "seq">,
  redis: Redis | null = getRedis(),
): Promise<AppendDuelResult> {
  if (!redis) return { kind: "unavailable" };
  const seq = await redis.incr(SEQ_KEY);
  const entry: DuelEntry = {
    seq,
    duelId: duel.duelId,
    winnerPostId: duel.winnerPostId,
    loserPostId: duel.loserPostId,
    day: duel.day,
  };
  await redis.rpush(DUELS_KEY, entry);
  return { kind: "recorded", entry };
}

/** The whole duel ledger, oldest first. Empty when nobody has dueled — or
 * when Redis isn't configured. */
export async function readDuelLedger(
  redis: Redis | null = getRedis(),
): Promise<DuelEntry[]> {
  if (!redis) return [];
  return redis.lrange<DuelEntry>(DUELS_KEY, 0, -1);
}

/** Entries strictly after `afterSeq`, oldest first — zero reads the whole
 * ledger. Strikes leave gaps in seq, so position is not seq: this filters on
 * the entries themselves. Null-Redis safe: empty. */
export async function readDuelsSince(
  afterSeq: number,
  redis: Redis | null = getRedis(),
): Promise<DuelEntry[]> {
  const ledger = await readDuelLedger(redis);
  return ledger.filter((entry) => entry.seq > afterSeq);
}

/** The cached fold checkpoint, or null when none exists (or Redis isn't
 * configured) — callers then fold from nothing. */
export async function readCheckpoint(
  redis: Redis | null = getRedis(),
): Promise<Checkpoint | null> {
  if (!redis) return null;
  return redis.get<Checkpoint>(CHECKPOINT_KEY);
}

export async function writeCheckpoint(
  checkpoint: Checkpoint,
  redis: Redis | null = getRedis(),
): Promise<WriteCheckpointResult> {
  if (!redis) return "unavailable";
  await redis.set(CHECKPOINT_KEY, checkpoint);
  return "written";
}

/** The current rating table: the checkpoint (when present) plus a fold of
 * the duels after it — by foldDuels' resume law this equals folding the
 * whole ledger from nothing. Null-Redis safe: empty. */
export async function readRatingTable(
  redis: Redis | null = getRedis(),
): Promise<RatingTable> {
  if (!redis) return {};
  const checkpoint = await readCheckpoint(redis);
  const tail = await readDuelsSince(checkpoint?.seq ?? 0, redis);
  return foldDuels(tail, checkpoint ?? undefined);
}

/**
 * Strike duels from the ledger — the corrections lever. Each named entry is
 * removed with `lrem` on its exact stored value (no read-filter-rewrite, so
 * a concurrent append is never lost), then the checkpoint is dropped. That
 * order matters: invalidating first would let a reader rebuild a checkpoint
 * from the not-yet-struck ledger and poison it; striking first leaves at
 * worst a stale checkpoint that the delete then clears. The seq counter
 * never rewinds — struck entries leave gaps, and read-since is filter-based
 * for exactly that reason.
 */
export async function strikeDuels(
  duelIds: readonly string[],
  redis: Redis | null = getRedis(),
): Promise<StrikeDuelsResult> {
  if (!redis) return { kind: "unavailable" };
  const wanted = new Set(duelIds);
  const targets = (await readDuelLedger(redis)).filter((entry) =>
    wanted.has(entry.duelId),
  );
  for (const entry of targets) {
    await redis.lrem(DUELS_KEY, 1, entry);
  }
  await redis.del(CHECKPOINT_KEY);
  const struckIds = new Set(targets.map((entry) => entry.duelId));
  return {
    kind: "struck",
    struck: duelIds.filter((id) => struckIds.has(id)),
    missing: duelIds.filter((id) => !struckIds.has(id)),
  };
}
