import { NextResponse } from "next/server";
import { encodeRecord, recordFromScripts, TXID_RE } from "@/app/folklore/linkRecord";
import { addLinkToBoard, indexSince, isBoardLink } from "@/lib/folkloreBoard";
import { quoteLink } from "@/lib/folkloreJob/linkQuote";
import { REVENUE_ADDRESS, revenueSatsTo } from "@/lib/revenueAddress";
import { fetchTxOutputs, fetchTxScripts } from "@/lib/whatsonchain";
import { gbpPerBsv } from "@/lib/xPrice";

// A cached delta would freeze a client's watermark, so this route is dynamic
// and the response is never stored.
export const dynamic = "force-dynamic";

/**
 * GET /api/folklore/index?since=<ms> → { txids: string[], now: number }
 *
 * The delta feed the app's folklore file syncs against: every txid the board
 * index learned of at or since `since` (index-insertion time, never block
 * time), oldest first, plus the server's own clock for the client to store
 * verbatim as its next watermark. Read-only and public — txids are
 * already-public data, the same posture as the showroom reads. A garbage or
 * negative `since` reads as 0 (the full first sync), never an error.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("since");
  const parsed = Number.parseInt(raw ?? "0", 10);
  const since = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const result = await indexSince(since);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

// The whole request envelope: `{ stampTxid }` is under a hundred bytes; four
// kilobytes is generous slack before anything is read into memory.
const MAX_REQUEST_BYTES = 4 * 1024;

function refusal(reason: string, status: number, detail: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, reason, ...detail }, { status });
}

/**
 * POST /api/folklore/index  application/json  { "stampTxid": "<64 hex>" }
 *
 * The cheap path's index (specification, Decision 4). The submitter has
 * already signed and broadcast the stamp — a folklore link record in
 * OP_RETURN naming its target, plus a payment to the revenue address — so
 * the site holds no key, opens no job and pays nobody. This reads the stamp
 * back off the chain, checks that the record names a target and that the
 * payment meets the live ten-pence floor, and lands the target on the board
 * under link:<target>. Nothing here can cost the caller money they have not
 * already spent, and a refusal always says why.
 *
 * `by` on the stamp is a claim the chain carries exactly as the submitter
 * wrote it. The broadcast is the signature, so no second one is asked for
 * here; the payout side still requires the handle's owner record at
 * settlement (specification §4), so an unbound claim lists but is never paid.
 *
 * Refusals, each named in the body: not-available (503, the flag is dark) ·
 * too-large (413) · bad-input (400) · unknown-tx (400: the stamp cannot be
 * read from the chain yet — index it again once it has propagated) ·
 * bad-record (400: no folklore link in the stamp) · not-a-target (400: a
 * legacy https-only record) · already-listed (409, with the target) ·
 * price-unavailable (503: no live rate, so no honest floor) · floor-short
 * (402, with the satoshis paid and the floor) · store-unavailable (503: the
 * stamp stands on chain; index it again later).
 */
export async function POST(req: Request) {
  // The exact-string gate the submit page and the link route share: while
  // the flag is dark the body is never even read.
  if (process.env.FOLKLORE_SUBMIT_ENABLED !== "true") {
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
  const stampTxid =
    typeof body === "object" && body !== null
      ? (body as { stampTxid?: unknown }).stampTxid
      : undefined;
  if (typeof stampTxid !== "string" || !TXID_RE.test(stampTxid)) {
    return refusal("bad-input", 400);
  }
  const stamp = stampTxid.toLowerCase();

  const scripts = await fetchTxScripts(stamp);
  if (!scripts) return refusal("unknown-tx", 400);
  const record = recordFromScripts(scripts);
  if (!record || record.kind !== "link") return refusal("bad-record", 400);
  if (!record.txid) return refusal("not-a-target", 400);
  const target = record.txid;

  // The cheap pre-check, before any rate or payment read: a listed target is
  // refused whatever its stamp paid (Decision 3, one row per target). The
  // nx write at the end still decides between two stamps arriving together.
  if (await isBoardLink(target)) return refusal("already-listed", 409, { target });

  const outputs = await fetchTxOutputs(stamp);
  if (!outputs) return refusal("unknown-tx", 400);
  // The same bytes and the same floor the submitter was quoted: encodeRecord
  // is the one encoder and quoteLink the one floor, both at the rate right
  // now. The miner fee is the submitter's own and is not checked here.
  const quoted = quoteLink(encodeRecord(record).length, await gbpPerBsv());
  if (!quoted) return refusal("price-unavailable", 503);
  const revenueSats = revenueSatsTo(REVENUE_ADDRESS, outputs);
  if (revenueSats < quoted.premiumSats) {
    return refusal("floor-short", 402, { revenueSats, floorSats: quoted.premiumSats });
  }

  const landed = await addLinkToBoard(stamp, record, Date.now());
  if (landed === "unavailable") return refusal("store-unavailable", 503);
  if (landed === "already-listed") return refusal("already-listed", 409, { target });
  return NextResponse.json({ ok: true, target, stampTxid: stamp });
}
