// Put the board's documents on the chain: every surface whose content changed
// since its last inscription, chained in one run so each spends the previous
// change, then the head naming all of them, inscribed last. A refused
// inscription stops the run before the head — a head must never name a
// transaction that did not land — and reports as a failed step, so the
// publish exits non-zero exactly as it does for a refused store write.
//
// The local ledger (content/board/.chain-ledger.json, gitignored beside the
// documents) is written after every broadcast, so a run that dies midway
// keeps what landed and the next run continues from it.

import { readFile, writeFile } from "node:fs/promises";
import { inscribeDocument } from "./chain-put.mjs";
import { inscribeHead } from "./chain-head.mjs";
import { CHAIN_REFUSED, reasonFor } from "./publish-core.mjs";
import { EMPTY_LEDGER, changedDocuments, digestOf, headSurfaces, withHead, withInscription } from "./chain-publish-core.mjs";

export async function readLedger(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e?.code === "ENOENT") return EMPTY_LEDGER;
    throw e;
  }
}

export async function writeLedger(path, ledger) {
  await writeFile(path, JSON.stringify(ledger, null, 2) + "\n");
}

/** Inscribe what changed, then the head. Returns the publish steps this run
 *  contributes and the ledger as it stands. Dry runs price and sign every
 *  transaction without broadcasting or writing the ledger. */
export async function publishToChain({
  documents, ledgerPath, wif, keyHex, date,
  dryRun = false, fetchImpl = fetch, log = console.log,
}) {
  let ledger = await readLedger(ledgerPath);
  const steps = [];
  const changed = changedDocuments(documents, ledger);
  if (changed.length === 0) {
    log("chain: nothing changed since the last inscription — no fee spent");
    return { steps, ledger };
  }

  let prevTx = null;
  for (const doc of changed) {
    const previousTxid = ledger.surfaces[doc.surface]?.txid ?? "";
    try {
      const out = await inscribeDocument({
        wif, keyHex, surface: doc.surface, date, bytes: doc.bytes,
        previousTxid, prevTx, feeCeiling: doc.feeCeiling, dryRun, fetchImpl, log,
      });
      prevTx = out.tx;
      const txid = out.txid ?? out.tx.id("hex");
      ledger = withInscription(ledger, { surface: doc.surface, txid, sha256: digestOf(doc.bytes), date });
      if (!dryRun) await writeLedger(ledgerPath, ledger);
      steps.push({ name: `chain:${doc.surface}`, failed: false });
    } catch (e) {
      steps.push({ name: `chain:${doc.surface}`, failed: true, reason: reasonFor(CHAIN_REFUSED, e.message) });
      return { steps, ledger }; // the head must not name what did not land
    }
  }

  try {
    const out = await inscribeHead({
      wif, keyHex, date, surfaces: headSurfaces(ledger),
      previousHeadTxid: ledger.head?.txid ?? "", prevTx, dryRun, fetchImpl, log,
    });
    const txid = out.txid ?? out.tx.id("hex");
    ledger = withHead(ledger, { txid, date });
    if (!dryRun) await writeLedger(ledgerPath, ledger);
    steps.push({ name: "chain:head", failed: false });
  } catch (e) {
    steps.push({
      name: "chain:head", failed: true,
      reason: reasonFor(CHAIN_REFUSED, `${changed.length} document(s) landed without a head naming them — ${e.message}`),
    });
  }
  return { steps, ledger };
}
