import { NextResponse } from "next/server";
import { OP, Script, Transaction, Utils } from "@bsv/sdk";
import { decryptPdf } from "./board-pdf-crypto";
import { INSCRIPTION_MARKER, downloadFilename, type EditionKind } from "./board-pdf";
import { getRedis } from "./redis";

const notRendered = () =>
  NextResponse.json({ error: "Not rendered yet — the next /hh run creates it." }, { status: 404 });

/** Streams a stored edition PDF decrypted from its BSV inscription, or a
 *  friendly 404 when no index entry, transaction, or decryptable payload is
 *  found. Read-only, no side effects. */
export async function servePdf(kind: EditionKind, date: string): Promise<Response> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notRendered();
  try {
    const redis = getRedis();
    if (!redis) return notRendered();
    const txid = await redis.get<string>(`board:pdftx:${kind}:${date}`);
    if (!txid || !/^[0-9a-f]{64}$/.test(txid)) return notRendered();

    const resp = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`);
    if (!resp.ok) return notRendered();
    const hex = (await resp.text()).trim();

    // The SDK's chunk parser stops at OP_RETURN and lumps everything after it
    // into that chunk's raw `data` — re-parse that blob to get the pushdata
    // fields (marker, kind, date, payload) individually.
    const tx = Transaction.fromHex(hex);
    let payload: number[] | undefined;
    for (const o of tx.outputs) {
      const [op0, op1] = o.lockingScript.chunks;
      if (op0?.op !== OP.OP_FALSE || op1?.op !== OP.OP_RETURN || !op1.data) continue;
      const fields = Script.fromBinary(op1.data).chunks;
      if (fields.length !== 4) continue;
      const [marker, fieldKind, fieldDate, fieldPayload] = fields;
      if (!marker.data || Utils.toUTF8(marker.data) !== INSCRIPTION_MARKER) continue;
      if (!fieldKind.data || Utils.toUTF8(fieldKind.data) !== kind) continue;
      if (!fieldDate.data || Utils.toUTF8(fieldDate.data) !== date) continue;
      if (!fieldPayload.data) continue;
      payload = fieldPayload.data;
      break;
    }
    if (!payload) return notRendered();

    const key = process.env.BOARD_ARCHIVE_KEY;
    if (!key) return notRendered();
    const pdf = decryptPdf(new Uint8Array(payload), key);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${downloadFilename(kind, date)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return notRendered();
  }
}
