import { getRedis } from "./redis";

/**
 * Nothing may spend our X API credit until it has paid for it.
 *
 * The X API bills per resource returned — a customer's timeline costs real
 * dollars to read, and the archive reward we receive on-chain is the only income
 * that read ever produces. So the order matters: verify the payment landed,
 * THEN spend. Before this module the order was the other way round, and the two
 * archive endpoints were public, so anyone with curl could spend our money and
 * pay nothing.
 *
 * We hold no key here. A payment is a transaction id, and a transaction id is
 * already public: we look it up on WhatsOnChain and count what it paid to the
 * archive reward address. Reading a payment cannot move a coin.
 */

/** The archive reward address. A receiving address — public by construction. */
export const X_ARCHIVE_REWARD_ADDRESS = "1mSxVgV1h7crdb8Qr3e7o3H18GczcUsiC";

const WOC = "https://api.whatsonchain.com/v1/bsv/main";
const SATS_PER_BSV = 100_000_000;

/**
 * Satoshis a caller must pay us for each X resource we are about to read.
 *
 * X charges $0.005 a resource. At BSV $12.975 that is 38,536 satoshis; with about
 * 29% margin, 49,505. The floor therefore SCALES with what a call will cost:
 * /api/x/fetch reads 101 resources and /api/x/archive reads 201, because it pages
 * the timeline twice — once for text, once for media. A single flat floor charged
 * both the same and lost money on the second.
 *
 * The price is pinned rather than fetched. A price feed can fail, and a failing
 * price feed must either fail open (spend money on a guess) or fail the endpoint,
 * and both are worse than a number a human chose and can see. The consequence is
 * that a fall in the BSV price erodes the margin: below about $10.10 a BSV this
 * no longer covers a call. Raise X_ARCHIVE_SATS_PER_RESOURCE when that happens.
 */
export const SATS_PER_RESOURCE = 49_505;

/** Reads only the one variable it needs, so a test can pass a bare object. */
export function minPaymentSatsFor(
  resources: number,
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.X_ARCHIVE_SATS_PER_RESOURCE);
  const perResource = Number.isFinite(raw) && raw > 0 ? raw : SATS_PER_RESOURCE;
  return Math.max(1, Math.ceil(Math.max(0, resources) * perResource));
}

export function isTxid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value);
}

type WocVout = { value?: number; scriptPubKey?: { addresses?: string[] } };
type WocTx = { vout?: WocVout[] };

/**
 * Pure. Satoshis a transaction pays to `address`, summed across its outputs.
 * WhatsOnChain reports output values in BSV, so the conversion happens here and
 * rounds — an output is a whole number of satoshis and floating point is not.
 */
export function satsPaidTo(tx: WocTx, address: string): number {
  return (tx.vout ?? []).reduce((total, out) => {
    const pays = out.scriptPubKey?.addresses?.includes(address) ?? false;
    return pays ? total + Math.round((out.value ?? 0) * SATS_PER_BSV) : total;
  }, 0);
}

export type PaymentVerdict =
  | { ok: true; sats: number }
  | { ok: false; reason: "bad-txid" | "not-found" | "underpaid" | "replayed" | "accounting-unavailable" };

/** Reads the chain. Does not consume the payment — see `consumePayment`. */
export async function verifyPayment(
  txid: string,
  minSats: number,
  fetchFn: typeof fetch = fetch,
): Promise<PaymentVerdict> {
  if (!isTxid(txid)) return { ok: false, reason: "bad-txid" };

  const res = await fetchFn(`${WOC}/tx/hash/${txid}`, { cache: "no-store" });
  if (!res.ok) return { ok: false, reason: "not-found" };

  const sats = satsPaidTo((await res.json()) as WocTx, X_ARCHIVE_REWARD_ADDRESS);
  return sats >= minSats ? { ok: true, sats } : { ok: false, reason: "underpaid" };
}

/**
 * Burn the payment so one transaction buys exactly one read.
 *
 * Fails CLOSED: with no Redis we cannot remember that a transaction was already
 * spent, so we refuse rather than let one payment buy an unbounded number of
 * reads. Verify first, consume last — a transaction that fails verification is
 * not burned, so a caller who mistypes a handle does not forfeit their payment.
 */
export async function consumePayment(txid: string): Promise<
  { ok: true } | { ok: false; reason: "replayed" | "accounting-unavailable" }
> {
  const redis = getRedis();
  if (!redis) return { ok: false, reason: "accounting-unavailable" };

  const claimed = await redis.set(`xapi:paid:${txid.toLowerCase()}`, 1, { nx: true });
  return claimed ? { ok: true } : { ok: false, reason: "replayed" };
}
