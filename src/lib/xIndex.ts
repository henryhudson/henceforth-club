import { getRedis } from "./redis";

// Public handle -> ordered list of archive root-TXIDs. A profile can span several
// transactions — an initial archive plus incremental deltas that add only the
// tweets not already on chain — so the index holds them oldest-first. Holds no
// keys and no money: a TXID is already public on the blockchain, and the handle
// is embedded in each inscription, so the whole index is rebuildable by scanning.

const key = (handle: string) => `x:${handle.toLowerCase()}`;

/**
 * All archive txids for a handle, oldest first. Migrates a legacy single-string
 * value (from when a handle mapped to one txid) into a one-element list.
 */
export async function getXTxids(handle: string): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  const raw = await redis.get<string | string[]>(key(handle));
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** The latest archive txid for a handle (the most recent delta), or null. */
export async function getXTxid(handle: string): Promise<string | null> {
  const txids = await getXTxids(handle);
  return txids.at(-1) ?? null;
}

/** Append a new archive txid to the handle's list. Idempotent — re-registering
 * the same txid is a no-op, so a retry never duplicates. */
export async function appendXTxid(handle: string, txid: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const existing = await getXTxids(handle);
  if (existing.includes(txid)) return true;
  await redis.set(key(handle), [...existing, txid]);
  return true;
}

/** Replace a handle's entire txid list. Used when an owner claims a handle and
 * the canonical feed is reset to their archive, dropping any pre-claim
 * stranger-inscribed transactions (which remain reachable by their own txid). */
export async function setXTxids(handle: string, txids: string[]): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.set(key(handle), txids);
  return true;
}

// The public directory (/folklore): who has registered, newest first. A single
// sorted set rather than one row per handle — the score is the last time the
// handle registered, so the whole directory reads back pre-sorted with one
// call. Holds no keys and no money, same as the rest of this module.

const HANDLES_KEY = "x:handles";

/** Record `handle`'s latest registration time in the public directory,
 * idempotently upward — `gt: true` means an out-of-order or replayed stamp
 * with an older time never lowers the handle's position. False when Redis
 * isn't configured. */
export async function stampHandle(handle: string, atMs: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.zadd(HANDLES_KEY, { gt: true }, { score: atMs, member: handle.toLowerCase() });
  return true;
}

/**
 * The directory cards for named handles, in the order asked, skipping any the
 * directory has never registered.
 *
 * `listHandles` answers "who registered most recently", which is the wrong
 * question for a caller that already knows WHICH handles it needs — the
 * folklore board ranks by kudos, so the handles it wants can sit anywhere in
 * registration order, including past the end of any window. One `zmscore`
 * against the same sorted set answers the whole batch in a single round trip.
 *
 * A handle with no score is a handle the directory does not hold: it produces
 * no card, so a board member naming it still renders nothing. That absence is
 * deliberate — it is the moderation lever and the unknown-handle drop, not a
 * read worth retrying.
 */
export async function readHandleCards(
  handles: string[],
): Promise<{ handle: string; latestMs: number }[]> {
  const redis = getRedis();
  if (!redis || handles.length === 0) return [];
  const members = handles.map((handle) => handle.toLowerCase());
  const scores = await redis.zmscore(HANDLES_KEY, members);
  if (!scores) return [];
  return members.flatMap((handle, i) => {
    const score = scores[i];
    // Absence first, coercion second, and the order matters: a member the
    // directory does not hold comes back null, and `Number(null)` is 0 — a
    // perfectly finite number that would date a card to 1970 instead of
    // dropping it. That drop is the delisting lever, so it is tested before
    // the value is touched.
    if (score === null || score === undefined) return [];
    // Then coerce rather than type-check, because `listHandles` reads this
    // same sorted set a few lines below through a `(string | number)[]`
    // generic and coerces with `Number(...)` — the score arrives via the
    // client's generic recursive parser, so its runtime type is not
    // guaranteed. Two readers of one set disagreeing about what a score is
    // would silently drop the very handles this look-up exists to rescue.
    const latestMs = Number(score);
    return Number.isFinite(latestMs) ? [{ handle, latestMs }] : [];
  });
}

/** Registered handles, newest-stamped first. Empty when nobody has
 * registered yet, or when Redis isn't configured. */
export async function listHandles(limit = 50): Promise<{ handle: string; latestMs: number }[]> {
  const redis = getRedis();
  if (!redis) return [];
  const rows = await redis.zrange<(string | number)[]>(HANDLES_KEY, 0, limit - 1, {
    rev: true,
    withScores: true,
  });
  const out: { handle: string; latestMs: number }[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    out.push({ handle: String(rows[i]), latestMs: Number(rows[i + 1]) });
  }
  return out;
}
