import { NextResponse } from "next/server";
import { OP, Script, Transaction, Utils } from "@bsv/sdk";
import { decryptPdf, openSealed } from "./board-pdf-crypto";
import { CHAIN_MARKER, INSCRIPTION_MARKER, downloadFilename, type EditionKind } from "./board-pdf";
import { SURFACE } from "./chain-archive";
import { chainSurfaceTxid } from "./board-data";
import { getRedis } from "./redis";

const notRendered = () =>
  NextResponse.json({ error: "Not rendered yet — the next /hh run creates it." }, { status: 404 });

/** Streams a stored edition PDF decrypted from its BSV inscription, or a
 *  friendly 404 when no index entry, transaction, or decryptable payload is
 *  found. Read-only, no side effects. */
export async function servePdf(kind: EditionKind, date: string): Promise<Response> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notRendered();
  try {
    // The head names every edition (task five of the archive); the store's
    // own index is the fallback until task six retires it.
    let txid = await chainSurfaceTxid(SURFACE.edition(kind, date));
    if (!txid) {
      const redis = getRedis();
      if (!redis) return notRendered();
      txid = await redis.get<string>(`board:pdftx:${kind}:${date}`);
    }
    if (!txid || !/^[0-9a-f]{64}$/.test(txid)) return notRendered();

    const resp = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`);
    if (!resp.ok) return notRendered();
    const hex = (await resp.text()).trim();

    // The SDK's chunk parser stops at OP_RETURN and lumps everything after it
    // into that chunk's raw `data` — re-parse that blob to get the pushdata
    // fields individually. Two envelopes are read: the chain envelope every
    // inscription since 2026-08-30 carries (six fields, sealed payload), and
    // the legacy one before it (four fields, encrypted payload).
    const tx = Transaction.fromHex(hex);
    let found: { sealed: number[] } | { encrypted: number[] } | null = null;
    for (const o of tx.outputs) {
      const [op0, op1] = o.lockingScript.chunks;
      if (op0?.op !== OP.OP_FALSE || op1?.op !== OP.OP_RETURN || !op1.data) continue;
      const fields = Script.fromBinary(op1.data).chunks;
      const text = (i: number): string | null => {
        const data = fields[i]?.data;
        return data ? Utils.toUTF8(data) : null;
      };
      const sealed = fields[5]?.data;
      if (fields.length === 6 && sealed && text(0) === CHAIN_MARKER && text(1) === `${kind}-edition` && text(2) === date) {
        found = { sealed };
        break;
      }
      const encrypted = fields[3]?.data;
      if (fields.length === 4 && encrypted && text(0) === INSCRIPTION_MARKER && text(1) === kind && text(2) === date) {
        found = { encrypted };
        break;
      }
    }
    if (!found) return notRendered();

    const key = process.env.BOARD_ARCHIVE_KEY;
    if (!key) return notRendered();
    const pdf = "sealed" in found ? openSealed(new Uint8Array(found.sealed), key) : decryptPdf(new Uint8Array(found.encrypted), key);

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
