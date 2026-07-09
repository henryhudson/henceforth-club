import { getRedis } from "./redis";

/**
 * The verified owner of a handle. The permanent evidence is the binding tweet on
 * Bitcoin (bindingTxid + bindingPostId); this record is a rebuildable access gate,
 * not the source of truth — if it were lost, an owner re-establishes it by
 * re-signing, because they still hold the key and the tweet is still on chain.
 */
export type XOwner = {
  address: string;       // the committed identity address, A
  pubkey: string;        // the public key that derives to A (checked, not trusted)
  boundAt: number;       // unix seconds, from the claim transaction's chain time
  bindingTxid: string;   // the archive carrying the binding tweet
  bindingPostId: string; // the X post id, so the site can surface the permalink
};

const key = (handle: string) => `x:owner:${handle.toLowerCase()}`;

export async function getOwner(handle: string): Promise<XOwner | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get(key(handle))) ?? null;
}

export async function setOwner(handle: string, owner: XOwner): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.set(key(handle), owner);
  return true;
}

/**
 * Pure. What a claim by `claimantAddress` should do, given the current owner.
 * First valid claim wins: an unclaimed handle is established; the established
 * owner may append more of their own archives; anyone else is refused.
 */
export function claimOutcome(
  existing: XOwner | null,
  claimantAddress: string,
): "establish" | "append" | "reject" {
  if (!existing) return "establish";
  return existing.address === claimantAddress ? "append" : "reject";
}
