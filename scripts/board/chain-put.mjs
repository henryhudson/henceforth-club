// Put any document on the chain: seal it, wrap it in the envelope, build
// the transaction, fee it, refuse it if its only output would be data, sign
// it, and broadcast it. One implementation for every caller; render-pdf.mjs
// inscribes editions through here, and the board surfaces follow.
//
// usage (dry run by default; nothing is broadcast without --broadcast):
//   node --env-file=.env.local scripts/board/chain-put.mjs <surface> <YYYY-MM-DD> <file> [--previous <txid>] [--broadcast]
//
// A dry run builds and signs against a fake hundred-thousand-satoshi source
// so the fee, the change and the envelope are all real; only the input is
// not. The fake is sized to price any real edition (a 214-kilobyte sheet
// runs about twenty thousand satoshis) without ever passing the fee ceiling.

import { readFileSync } from "node:fs";
import { LockingScript, OP, P2PKH, PrivateKey, SatoshisPerKilobyte, Transaction } from "@bsv/sdk";
import { assertHasChange, buildEnvelope, keyIdentifier, sealPayload } from "./chain-put-core.mjs";

// 100 satoshis per kilobyte is the rate both transaction processors advertise
// (arc.taal.com and arc.gorillapool.io policy endpoints, checked 2026-07-07).
// Pinned rather than read live so a dry run and a real run price identically.
export const FEE_RATE_SATS_PER_KB = 100;
// A one-page edition runs about five thousand satoshis. The ceiling is
// generous headroom whose job is catching pathologies, not budgeting: the
// sdk's Transaction.fee() silently deletes the change output when change is
// not positive, and a large payload against a small input would otherwise
// hand the whole input to the miner.
export const FEE_CEILING_SATS = 30_000;
export const DRY_RUN_SOURCE_SATS = 100_000;
const WOC = "https://api.whatsonchain.com/v1/bsv/main";

/** The change output a follow-up inscription can spend, or -1. */
export function changeOutputIndex(tx) {
  return tx.outputs.findIndex((o) => o.change === true && (o.satoshis ?? 0) > 0);
}

// Where the input comes from, in order of preference: the previous
// transaction in this run (its change is not yet indexed anywhere else), a
// fake output on a dry run, or the largest spendable output the indexer
// reports for the key's address.
async function sourceFor({ address, prevTx, dryRun, fetchImpl }) {
  if (prevTx) {
    const changeIndex = changeOutputIndex(prevTx);
    if (changeIndex < 0) throw new Error("previous transaction in this run has no change output to chain from");
    return { sourceTransaction: prevTx, sourceOutputIndex: changeIndex, sourceLabel: "previous transaction's change" };
  }
  if (dryRun) {
    const fake = new Transaction();
    fake.addOutput({ lockingScript: new P2PKH().lock(address), satoshis: DRY_RUN_SOURCE_SATS });
    return { sourceTransaction: fake, sourceOutputIndex: 0, sourceLabel: `fake ${DRY_RUN_SOURCE_SATS}-satoshi utxo` };
  }
  // Mempool-inclusive: the plain /unspent endpoint is confirmed-only and
  // hides freshly broadcast change.
  const unspentResp = await fetchImpl(`${WOC}/address/${address}/unspent/all`);
  if (!unspentResp.ok) throw new Error(`fetching unspent outputs for ${address} failed: ${await unspentResp.text()}`);
  const { result } = await unspentResp.json();
  const spendable = (Array.isArray(result) ? result : []).filter((u) => !u.isSpentInMempoolTx);
  if (spendable.length === 0) {
    throw new Error(`no spendable outputs for ${address} — the archive key is unfunded, or its change is still propagating`);
  }
  const utxo = spendable.reduce((largest, u) => (u.value > largest.value ? u : largest));
  const hexResp = await fetchImpl(`${WOC}/tx/${utxo.tx_hash}/hex`);
  if (!hexResp.ok) throw new Error(`fetching source tx ${utxo.tx_hash} failed: ${await hexResp.text()}`);
  return {
    sourceTransaction: Transaction.fromHex((await hexResp.text()).trim()),
    sourceOutputIndex: utxo.tx_pos,
    sourceLabel: `utxo ${utxo.tx_hash}:${utxo.tx_pos}`,
  };
}

/** Seal, envelope, build, fee, guard, sign, and (unless dryRun) broadcast.
 *  Returns the transaction so the next inscription in a run can spend its
 *  change in process, plus what a caller needs to log and index. */
export async function inscribeDocument({
  wif, keyHex, surface, date, bytes, previousTxid = "", prevTx = null,
  dryRun = false, fetchImpl = fetch, log = console.log,
}) {
  const key = PrivateKey.fromWif(wif);
  const address = key.toAddress();
  const sealed = sealPayload(bytes, keyHex);
  const chunks = buildEnvelope({ surface, date, keyId: keyIdentifier(keyHex), previousTxid, sealed });

  const { sourceTransaction, sourceOutputIndex, sourceLabel } = await sourceFor({ address, prevTx, dryRun, fetchImpl });
  const inputValue = sourceTransaction.outputs[sourceOutputIndex].satoshis ?? 0;

  const tx = new Transaction();
  tx.addInput({ sourceTransaction, sourceOutputIndex, unlockingScriptTemplate: new P2PKH().unlock(key) });
  const data = new LockingScript().writeOpCode(OP.OP_FALSE).writeOpCode(OP.OP_RETURN);
  for (const chunk of chunks) data.writeBin(Array.from(chunk));
  tx.addOutput({ lockingScript: data, satoshis: 0 });
  tx.addP2PKHOutput(address); // change; the sdk computes the amount in fee()

  await tx.fee(new SatoshisPerKilobyte(FEE_RATE_SATS_PER_KB));
  const fee = tx.getFee();
  const change = assertHasChange(tx.outputs); // never a data-only transaction
  if (fee > FEE_CEILING_SATS) {
    throw new Error(`refusing to sign: computed fee ${fee} satoshis exceeds the ${FEE_CEILING_SATS}-satoshi ceiling (input ${inputValue} satoshis)`);
  }
  await tx.sign();

  const summary = { tx, fee, change: change.satoshis, payloadBytes: sealed.length, sourceLabel, txid: null };
  if (dryRun) {
    log(`dry-run ${surface} ${date}: fee ${fee} satoshis, change ${change.satoshis} satoshis (input ${inputValue} satoshis, ${sealed.length}-byte payload, source: ${sourceLabel}) — not broadcast`);
    return summary;
  }

  const resp = await fetchImpl(`${WOC}/tx/raw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txhex: tx.toHex() }),
  });
  // The indexer answers with the id, possibly JSON-quoted.
  const body = (await resp.text()).trim().replace(/^"+|"+$/g, "");
  if (!resp.ok || !/^[0-9a-fA-F]{64}$/.test(body)) throw new Error(`broadcast failed: ${body}`);
  summary.txid = body.toLowerCase();
  log(`inscribed ${surface} ${date} → ${summary.txid} (${bytes.length} bytes, fee ${fee} satoshis)`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const broadcast = args.includes("--broadcast");
  const prevIdx = args.indexOf("--previous");
  const previousTxid = prevIdx >= 0 ? args[prevIdx + 1] : "";
  const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--previous");
  const [surface, date, file] = positional;
  if (!surface || !date || !file) {
    console.error("usage: chain-put.mjs <surface> <YYYY-MM-DD> <file> [--previous <txid>] [--broadcast]");
    process.exit(2);
  }
  const wif = process.env.BOARD_ARCHIVE_WIF;
  const keyHex = process.env.BOARD_ARCHIVE_KEY;
  if (!wif || !keyHex) {
    console.error("BOARD_ARCHIVE_WIF and BOARD_ARCHIVE_KEY are required — run with --env-file=.env.local");
    process.exit(1);
  }
  const out = await inscribeDocument({ wif, keyHex, surface, date, bytes: readFileSync(file), previousTxid, dryRun: !broadcast });
  if (out.txid) console.log(out.txid);
}
