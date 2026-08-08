// The £3 endowed-handle pass (Henry's idea, shaped 2026-07-18): one purchase
// endows a BOUND handle, and repeat text archives of that handle are then
// priced at zero to the visitor. Handle-scoped, riding the spec C
// handle-to-key binding the system already has — no site account, no password
// store, no personal-data surface. FLAG-DARK: every reachable edge sits
// behind FOLKLORE_ENDOWED_PASS_ENABLED (checked in the routes, never here),
// and the purchase additionally behind the archive surface's own
// XFOLKLORE_WEB_ARCHIVE_ENABLED — while either is off, nothing in this module
// is reachable from the network.
//
// Pricing follows the house shape: the fee half is delegated to
// estimateSingleOpReturn (src/lib/archiveCost.ts) exactly as quote.ts and
// linkQuote.ts delegate theirs — never a second fee formula — and the £3
// converts at the live rate at quote time, failing closed without one.
//
// The free repeat stays inside the card's own byte constraint by
// construction: the only archive that can redeem a pass is one parseExport
// built — text-only posts ({id, at, text}), capped at MAX_ARCHIVE_BYTES —
// so an endowed re-archive's marginal cost is pence, never a media timeline.
//
// What is deliberately NOT here: the worker leg that funds a zero-price
// inscription. A pass-holder's repeat archive has no payment UTXO, so the
// worker would need a standing hot float wallet — a NEW custody surface the
// card requires a full money-path adversarial review for. Until that exists,
// the worker refuses endowed jobs (publishKeys skips them) and they expire
// unfunded: fail closed, nothing inscribed, no money moved.

import type { Redis } from "@upstash/redis";
import { getRedis } from "@/lib/redis";
import { estimateSingleOpReturn } from "@/lib/archiveCost";
import { DUST_SATS, type Quote } from "./quote";
import type { TextJob } from "./jobs";

/** The pass price Henry set: three pounds, once, per bound handle. */
export const PASS_POUNDS = 3;

/** The endowment record the purchase inscribes — the on-chain evidence that
 * this handle's archive was endowed, carrying the identity address the handle
 * was bound to at purchase. `app` is deliberately NOT "folklore": the worker's
 * legacy payload sniff routes on that exact string. */
export type EndowmentRecord = {
  v: 1;
  app: "folklore-pass";
  handle: string;
  address: string;
};

export function endowmentRecord(handle: string, address: string): EndowmentRecord {
  return { v: 1, app: "folklore-pass", handle: handle.toLowerCase(), address };
}

/** The one encoder for the endowment record — the priced bytes, the content
 * hash, and the eventual OP_RETURN must never disagree (the encodeRecord
 * principle). */
export function encodeEndowment(record: EndowmentRecord): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(record));
}

/**
 * The message a purchase signs. Only the handle's bound key may endow it —
 * the pass is scoped BY the binding, so an unbound handle has nothing to
 * scope to and a stranger cannot endow a handle they cannot sign for.
 * Not closed here, and small (the link route's own posture): a captured
 * signature replayed can only open another purchase job for the same handle,
 * which the replayer would have to pay for and already-endowed refuses once
 * the pass is recorded.
 */
export function purchaseMessage(handle: string): string {
  return `folklore-endow:${handle.toLowerCase()}`;
}

/** The message a redemption signs. Including the content hash pins the
 * signature to the exact export being archived: a captured redemption
 * signature can only re-archive the IDENTICAL content, never new material. */
export function redeemMessage(handle: string, contentHash: string): string {
  return `folklore-endow-redeem:${handle.toLowerCase()}:${contentHash}`;
}

/** A negative or non-finite byte count is not a record; price it as zero
 * bytes rather than let it produce an unrepresentable quote. */
function normalizedBytes(bytes: number): number {
  return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
}

/** price = the endowment record's inscription fee + £3 at the live rate; the
 * £3 is the premium (the worker already pays any premium to the revenue
 * address — no new worker money leg). Fail-closed: no live rate → no quote;
 * a £3 leg at or below dust → no quote. */
export function quotePass(recordBytes: number, gbpPerBsv: number | undefined): Quote | null {
  if (gbpPerBsv === undefined || !Number.isFinite(gbpPerBsv) || gbpPerBsv <= 0) return null;
  const feeSats = estimateSingleOpReturn(normalizedBytes(recordBytes)).minerFeeSats;
  const passSats = Math.ceil((100_000_000 * PASS_POUNDS) / gbpPerBsv);
  if (passSats <= DUST_SATS) return null;
  return { feeSats, floatSats: 0, premiumSats: passSats, priceSats: feeSats + passSats };
}

/**
 * The redeemed repeat's quote: priced at ZERO to the visitor. The fee is
 * still recorded honestly — it is what the worker's (future) float leg must
 * fund — but priceSats is what the visitor pays, and a pass-holder pays
 * nothing. Pure and rate-free: with nothing charged there is no pound leg to
 * convert, so a rate outage cannot refuse a redemption.
 */
export function quoteEndowedRepeat(archiveBytes: number): Quote {
  const feeSats = estimateSingleOpReturn(normalizedBytes(archiveBytes)).minerFeeSats;
  return { feeSats, floatSats: 0, premiumSats: 0, priceSats: 0 };
}

/**
 * The recorded pass. Like the owner record (src/lib/xOwner.ts) this is a
 * rebuildable access gate, not the source of truth — the endowment record is
 * on chain, pointed at by inscriptionTxid. No expiry field yet: whether a
 * pass expires is a terms decision only Henry can make (prepaid revenue is a
 * liability), and until it is made a recorded pass simply persists.
 */
export type EndowedPass = {
  handle: string; // lowercased, the key it is stored under
  jobId: string; // the purchase job that paid for it
  inscriptionTxid?: string; // the endowment record on chain
  purchasedAtMs: number;
  priceSats: number; // what the purchase actually charged
};

const passKey = (handle: string) => `x:pass:${handle.toLowerCase()}`;
const passIssueKey = (jobId: string) => `x:pass:issue:${jobId}`;

/**
 * The same three-way read the money gates already use (readOwner,
 * readLinkRecord): a pass, a genuine absence, or a store we could not reach —
 * an outage must answer "ask again", never "this handle has no pass".
 */
export type PassRead =
  | { kind: "pass"; pass: EndowedPass }
  | { kind: "absent" }
  | { kind: "unavailable" };

export async function readPass(
  handle: string,
  redis: Redis | null = getRedis(),
): Promise<PassRead> {
  if (!redis) return { kind: "unavailable" };
  const pass = await redis.get<EndowedPass>(passKey(handle));
  return pass ? { kind: "pass", pass } : { kind: "absent" };
}

export type PassRecordResult =
  | { kind: "recorded"; pass: EndowedPass }
  | { kind: "already-recorded" }
  | { kind: "not-a-pass-job" }
  | { kind: "unavailable" };

/**
 * Record a completed purchase's pass, exactly once. The caller gates on the
 * job being done and on FOLKLORE_ENDOWED_PASS_ENABLED — this function owns
 * only the recording and its idempotence (the floatFunding shape: claim with
 * one atomic set-if-absent, then write; a crash between the two leaves a
 * visible claim without its pass, healable by hand, never a double record).
 */
export async function recordPassOnCompletion(
  job: Pick<TextJob, "jobId" | "kind" | "handle" | "priceSats" | "inscriptionTxid">,
  nowMs: number,
  redis: Redis | null = getRedis(),
): Promise<PassRecordResult> {
  if (job.kind !== "pass") return { kind: "not-a-pass-job" };
  if (!redis) return { kind: "unavailable" };

  const claimed = await redis.set(passIssueKey(job.jobId), job.handle.toLowerCase(), { nx: true });
  if (claimed === null) return { kind: "already-recorded" };

  const pass: EndowedPass = {
    handle: job.handle.toLowerCase(),
    jobId: job.jobId,
    ...(job.inscriptionTxid ? { inscriptionTxid: job.inscriptionTxid } : {}),
    purchasedAtMs: nowMs,
    priceSats: job.priceSats,
  };
  await redis.set(passKey(job.handle), pass);
  return { kind: "recorded", pass };
}
