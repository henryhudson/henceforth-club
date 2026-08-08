import { NextResponse } from "next/server";
import { Hash, Utils } from "@bsv/sdk";
import { readOwner } from "@/lib/xOwner";
import { verifyClaim } from "@/lib/xBinding";
import { createJob, listJobsInState } from "@/lib/folkloreJob/jobStore";
import {
  encodeEndowment,
  endowmentRecord,
  purchaseMessage,
  quotePass,
  readPass,
} from "@/lib/folkloreJob/pass";
import { gbpPerBsv } from "@/lib/xPrice";

// The whole request envelope: a handle, a public key, and a signature are
// well under a kilobyte; eight kilobytes is generous slack before anything
// is read into memory.
const MAX_REQUEST_BYTES = 8 * 1024;

// The same handle rule the export parser and link route enforce.
const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

function refusal(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/** Job states that still occupy a custody slot — a purchase already in one of
 * these for the same handle means a second quote now risks a double charge. */
const ACTIVE_STATES = ["quoted", "awaiting-payment", "funded", "inscribed"] as const;

/** Whether a pass purchase for this handle is already in flight. Like
 * createJob's own capacity count this check is not atomic with the write —
 * two simultaneous purchases can both pass it. That is the same accepted
 * exposure (one extra ephemeral job, which expires unpaid or, paid twice,
 * records one pass), not a consistency invariant worth a lock. */
async function passJobInFlight(handle: string): Promise<boolean> {
  const lower = handle.toLowerCase();
  for (const state of ACTIVE_STATES) {
    const jobs = await listJobsInState(state);
    if (jobs.some((j) => j.kind === "pass" && j.handle.toLowerCase() === lower)) return true;
  }
  return false;
}

/**
 * POST /api/folklore/pass  application/json
 *
 *   { "handle": "…", "pubkey": "<hex>", "signature": "<base64>" }
 *
 * The £3 endowed-handle pass purchase: quotes the endowment record's
 * inscription fee plus £3 at the live rate and opens it as an ephemeral job
 * on the same custodial rails the web archive rides. Only the handle's BOUND
 * key may endow it — the signature must verify over purchaseMessage(handle)
 * against the address the owner record committed to on chain (the committed
 * address comes from the STORED record, never from the request). The pass
 * itself is recorded when the purchase job completes, at the poll edge
 * (GET /api/folklore/job/[id]).
 *
 * FLAG-DARK and doubly so: refused unless BOTH FOLKLORE_ENDOWED_PASS_ENABLED
 * and XFOLKLORE_WEB_ARCHIVE_ENABLED are exactly "true", read per request —
 * a pass sells free repeats of the web archive surface, so selling one while
 * that surface is dark would take money for a service that cannot run.
 */
export async function POST(req: Request) {
  if (process.env.FOLKLORE_ENDOWED_PASS_ENABLED !== "true") {
    return refusal("not-available", 503);
  }
  if (process.env.XFOLKLORE_WEB_ARCHIVE_ENABLED !== "true") {
    return refusal("not-available", 503);
  }

  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return refusal("too-large", 413);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return refusal("bad-input", 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
    return refusal("too-large", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return refusal("bad-input", 400);
  }
  if (typeof body !== "object" || body === null) {
    return refusal("bad-input", 400);
  }

  const { handle, pubkey, signature } = body as Record<string, unknown>;
  if (typeof handle !== "string" || !HANDLE_PATTERN.test(handle)) {
    return refusal("bad-handle", 400);
  }
  if (typeof pubkey !== "string" || typeof signature !== "string") {
    return refusal("unsigned", 403);
  }

  // The binding is the whole scope of the pass: an unbound handle has no key
  // to endow against, and an unreachable store is not a verdict on the handle.
  const owner = await readOwner(handle);
  if (owner.kind === "unavailable") return refusal("store-unavailable", 503);
  if (owner.kind === "absent") return refusal("unbound-handle", 403);

  const verified = verifyClaim({
    message: purchaseMessage(handle),
    signatureBase64: signature,
    pubkeyHex: pubkey,
    committedAddress: owner.owner.address,
  });
  if (!verified) return refusal("bad-signature", 403);

  // Refuse before money: an endowed handle needs no second pass, and a
  // purchase already in flight must not be quoted twice.
  const existing = await readPass(handle);
  if (existing.kind === "unavailable") return refusal("store-unavailable", 503);
  if (existing.kind === "pass") return refusal("already-endowed", 409);
  if (await passJobInFlight(handle)) return refusal("purchase-in-flight", 409);

  const record = endowmentRecord(handle, owner.owner.address);
  const recordBytes = encodeEndowment(record);
  const quoted = quotePass(recordBytes.length, await gbpPerBsv());
  if (!quoted) {
    return refusal("price-unavailable", 503);
  }

  const contentHash = Utils.toHex(Hash.sha256(Array.from(recordBytes)));
  const created = await createJob(
    { kind: "pass", handle: record.handle, contentHash, archive: record },
    quoted,
    Date.now(),
  );
  if (!created.ok) {
    return refusal(created.refused, 503);
  }

  return NextResponse.json({
    jobId: created.job.jobId,
    priceSats: created.job.priceSats,
    feeSats: created.job.feeSats,
    passSats: quoted.premiumSats,
    expiresAtMs: created.job.expiresAtMs,
  });
}
