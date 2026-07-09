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
