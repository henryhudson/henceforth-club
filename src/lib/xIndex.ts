import { getRedis } from "./redis";

// Public handle -> root-TXID index for archived profiles. Holds no keys and no
// money: a TXID is already public on the blockchain. The index is a convenience —
// fully rebuildable by scanning the chain, since the handle is embedded in the
// inscription itself.

const key = (handle: string) => `x:${handle.toLowerCase()}`;

export async function getXTxid(handle: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get<string>(key(handle))) ?? null;
}

export async function setXTxid(handle: string, txid: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.set(key(handle), txid);
  return true;
}
