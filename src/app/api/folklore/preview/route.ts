import { NextResponse } from "next/server";
import { TXID_RE } from "@/app/folklore/linkRecord";
import { classifyTx } from "@/app/folklore/tx/classify";
import { fetchTxScripts } from "@/lib/whatsonchain";
import { previewFor } from "./preview";

/**
 * GET /api/folklore/preview?txid=<64 hex> → { ok: true, ...Preview }
 *
 * The submit form's look at a target before it asks anyone to sign: the
 * same parse the reader at /folklore/tx/<id> renders from, as JSON. Read-only
 * and public, the index feed's posture — an id is public data, and the chain
 * read is the one that page would make anyway. A malformed id is bad-input
 * (400); an id the chain cannot serve is unknown-tx (404), not an error —
 * the submitter may simply be early.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("txid") ?? "";
  if (!TXID_RE.test(raw)) {
    return NextResponse.json({ ok: false, reason: "bad-input" }, { status: 400 });
  }
  const txid = raw.toLowerCase();
  const scripts = await fetchTxScripts(txid);
  if (!scripts) {
    return NextResponse.json({ ok: false, reason: "unknown-tx" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...previewFor(classifyTx(scripts, txid), txid) });
}
