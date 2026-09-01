// The head: the archive address's newest inscription, a small sealed map of
// every surface to its current transaction. It is inscribed strictly AFTER
// the document it names — programmatic callers pass the document's own
// transaction as `prevTx`, so the head spends that document's change and the
// chain itself enforces the order — and it is chained to the previous head
// through the envelope's previous-transaction field, so the index's own
// history stays walkable.
//
// The head goes through inscribeDocument like any other surface, so it is
// compressed and sealed the same way: the map of what exists is as private
// as the documents it names.
//
// usage (dry run by default; nothing is broadcast without --broadcast):
//   node --env-file=.env.local scripts/board/chain-head.mjs <YYYY-MM-DD> <surfaces.json> [--previous <headTxid>] [--broadcast]

import { readFileSync } from "node:fs";
import { inscribeDocument } from "./chain-put.mjs";

export const HEAD_SURFACE = "head";
const SURFACE_SLUG = /^[a-z][a-z0-9-]*$/;
const TXID = /^[0-9a-f]{64}$/;

/** The head's payload bytes: a versioned map of surface → current txid.
 *  Refuses an empty map and any entry that could not be resolved later —
 *  a head that names nothing, or names it wrongly, is worse than no head. */
export function buildHeadPayload(surfaces) {
  const entries = Object.entries(surfaces ?? {});
  if (entries.length === 0) throw new Error("a head must name at least one surface");
  for (const [surface, txid] of entries) {
    if (!SURFACE_SLUG.test(surface)) throw new Error(`surface must be a lowercase slug, got ${JSON.stringify(surface)}`);
    if (typeof txid !== "string" || !TXID.test(txid)) throw new Error(`surface ${surface} names an invalid transaction id`);
  }
  return Buffer.from(JSON.stringify({ v: 1, surfaces }), "utf8");
}

/** The inverse, with the same refusals, so a reader never acts on a map this
 *  writer would not have signed. */
export function parseHeadPayload(bytes) {
  const parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  if (parsed === null || typeof parsed !== "object") throw new Error("head payload is not an object");
  if (parsed.v !== 1) throw new Error(`head payload version ${JSON.stringify(parsed.v)} is not 1`);
  buildHeadPayload(parsed.surfaces); // the same validation, one implementation
  return { v: 1, surfaces: parsed.surfaces };
}

/** Inscribe a head naming the current transaction of every surface.
 *  `prevTx` is the just-inscribed document whose change funds this head
 *  (the strict ordering); `previousHeadTxid` chains the envelope to the
 *  head before it. Dry runs price and sign without broadcasting. */
export async function inscribeHead({
  wif, keyHex, date, surfaces, previousHeadTxid = "", prevTx = null,
  dryRun = false, fetchImpl = fetch, log = console.log,
}) {
  return inscribeDocument({
    wif, keyHex, surface: HEAD_SURFACE, date,
    bytes: buildHeadPayload(surfaces),
    previousTxid: previousHeadTxid, prevTx, dryRun, fetchImpl, log,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const broadcast = args.includes("--broadcast");
  const prevIdx = args.indexOf("--previous");
  const previousHeadTxid = prevIdx >= 0 ? args[prevIdx + 1] : "";
  const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--previous");
  const [date, file] = positional;
  if (!date || !file) {
    console.error("usage: chain-head.mjs <YYYY-MM-DD> <surfaces.json> [--previous <headTxid>] [--broadcast]");
    process.exit(2);
  }
  const wif = process.env.BOARD_ARCHIVE_WIF;
  const keyHex = process.env.BOARD_ARCHIVE_KEY;
  if (!wif || !keyHex) {
    console.error("BOARD_ARCHIVE_WIF and BOARD_ARCHIVE_KEY are required — run with --env-file=.env.local");
    process.exit(1);
  }
  const surfaces = JSON.parse(readFileSync(file, "utf8"));
  const out = await inscribeHead({ wif, keyHex, date, surfaces, previousHeadTxid, dryRun: !broadcast });
  if (out.txid) console.log(out.txid);
}
