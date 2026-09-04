import { NextResponse } from "next/server";
import { TXID_RE } from "@/app/folklore/linkRecord";
import { classifyTx } from "@/app/folklore/tx/classify";
import { isBoardLink } from "@/lib/folkloreBoard";
import { claimReadSlot, clientAddress } from "@/lib/folkloreJob/submitThrottle";
import { fetchTxScripts } from "@/lib/whatsonchain";
import { previewFor } from "./preview";

/**
 * GET /api/folklore/preview?txid=<64 hex> → { ok: true, ...Preview }
 *
 * The submit form's look at a target before it asks anyone to sign: the
 * same parse the reader at /folklore/tx/<id> renders from, as JSON, plus one
 * board read — whether the id already has its row, so the form can refuse a
 * stamp before the ten pence is spent rather than learn it from the index's
 * 409 afterwards. Read-only and public, the index feed's posture — an id is
 * public data, and the chain read is the one that page would make anyway. A
 * malformed id is bad-input (400); an id the chain cannot serve is unknown-tx
 * (404), not an error — the submitter may simply be early; a bucket past the
 * read allowance is too-many-submissions (429, with retry-after).
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("txid") ?? "";
  if (!TXID_RE.test(raw)) {
    return NextResponse.json({ ok: false, reason: "bad-input" }, { status: 400 });
  }
  const txid = raw.toLowerCase();
  // The read allowance, claimed after the id is checked and before the chain
  // is asked: a malformed id costs no slot, and a refused read costs no
  // upstream call on the site's anonymous quota.
  const slot = await claimReadSlot(clientAddress(req), Date.now());
  if (slot.kind === "throttled") {
    return NextResponse.json(
      { ok: false, reason: "too-many-submissions" },
      { status: 429, headers: { "retry-after": String(slot.retryAfterSeconds) } },
    );
  }
  const scripts = await fetchTxScripts(txid);
  if (!scripts) {
    return NextResponse.json({ ok: false, reason: "unknown-tx" }, { status: 404 });
  }
  const listed = await isBoardLink(txid);
  return NextResponse.json({ ok: true, ...previewFor(classifyTx(scripts, txid), txid, listed) });
}
