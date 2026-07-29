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

/**
 * Which of these handles are owner-verified, in one round trip. The directory
 * shows a verified tick and reads nothing else off the record, so the answer
 * is the set of names rather than the records themselves — the smallest thing
 * that renders the row. An unreachable store yields an empty set, which the
 * row reads as "no tick": the same quiet absence a single `getOwner` gives.
 */
export async function getOwnedHandles(handles: string[]): Promise<Set<string>> {
  const redis = getRedis();
  const owned = new Set<string>();
  if (!redis || handles.length === 0) return owned;
  const values = await redis.mget<Array<XOwner | null>>(...handles.map(key));
  handles.forEach((handle, i) => {
    if (values[i]) owned.add(handle);
  });
  return owned;
}

/**
 * The same read as getOwner, with the answer a money gate needs: an owner, a
 * genuine absence, or a store we could not reach.
 *
 * getOwner collapses the last two into null, which is fine where the caller
 * only asks "is this handle claimed?" — but a submit path that refuses an
 * unbound handle would then answer "that handle is not bound, do not retry"
 * during an outage, when the honest answer is "ask again". Same distinction
 * readLinkRecord already draws, for the same reason.
 */
export type OwnerRead =
  | { kind: "owner"; owner: XOwner }
  | { kind: "absent" }
  | { kind: "unavailable" };

export async function readOwner(handle: string): Promise<OwnerRead> {
  const redis = getRedis();
  if (!redis) return { kind: "unavailable" };
  const owner = await redis.get<XOwner>(key(handle));
  return owner ? { kind: "owner", owner } : { kind: "absent" };
}

/**
 * True only when two handles are provably the SAME person: both bound, to one
 * identity address. Unprovable is false — an unbound handle on either side
 * says nothing, and this must never refuse an honest stranger.
 *
 * The bound it does not reach, stated rather than implied: an operator who
 * binds an alt account to a DIFFERENT key is two identities as far as any
 * evidence on chain goes, and this returns false for them. What the binding
 * gate buys against that route is cost and publicity, not impossibility —
 * every alt must hold a real X account and publish a binding post under it.
 */
export async function sameBoundIdentity(a: string, b: string): Promise<boolean> {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const [left, right] = await Promise.all([readOwner(a), readOwner(b)]);
  return (
    left.kind === "owner" && right.kind === "owner" && left.owner.address === right.owner.address
  );
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
