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
// The same interface, from a second operator. A first publish sends dozens of
// inscriptions in a row and WhatsOnChain answers 429 partway through (seen on
// the first real run, 2026-09-02, twice); the mirror carries the next one
// while the first cools off.
const MIRROR = "https://bananablocks.com/api/v1/bsv/main";
export const BROADCAST_ENDPOINTS = [WOC, MIRROR];
// Backoff between attempts, in milliseconds. Six attempts spread over about
// half a minute outlast a per-minute window without stalling a run.
export const BROADCAST_BACKOFF_MS = [500, 2_000, 5_000, 10_000, 15_000];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A read from the indexers, alternating between them and waiting out a
 *  refusal exactly as a broadcast does. Returns the body text. The first
 *  inscription of a run has no previous transaction to chain from, so it must
 *  ask an indexer for the address's coins and then for a source transaction;
 *  on the night of the first real publish WhatsOnChain answered that read with
 *  an HTML page, and the run ended before a single broadcast. A read is
 *  idempotent, so every non-answer is worth another attempt until the backoffs
 *  run out: a rate limit, a server error, a mirror that lacks the endpoint, or
 *  a challenge page dressed as a 200. */
export async function fetchIndexer(path, { fetchImpl = fetch, sleep = wait, log = console.log } = {}) {
  let last = "";
  for (let attempt = 0; attempt <= BROADCAST_BACKOFF_MS.length; attempt++) {
    const endpoint = BROADCAST_ENDPOINTS[attempt % BROADCAST_ENDPOINTS.length];
    const resp = await fetchImpl(`${endpoint}${path}`);
    const body = await resp.text();
    const looksLikeAPage = /^\s*<(!doctype html|html)/i.test(body);
    if (resp.ok && !looksLikeAPage) return body;
    last = `${resp.status}: ${body.slice(0, 160).replace(/\s+/g, " ")}`;
    if (attempt === BROADCAST_BACKOFF_MS.length) break;
    const pause = BROADCAST_BACKOFF_MS[attempt];
    const next = BROADCAST_ENDPOINTS[(attempt + 1) % BROADCAST_ENDPOINTS.length];
    log(`indexer read of ${path} refused by ${new URL(endpoint).host}; waiting ${pause}ms and trying ${new URL(next).host}`);
    await sleep(pause);
  }
  throw new Error(`indexer read failed for ${path}: ${last}`);
}

/** The transaction id in a broadcast's answer, or null if it does not carry
 *  one. WhatsOnChain replies with the bare id, sometimes JSON-quoted; the
 *  BananaBlocks mirror replies with a status object whose `txid` field holds
 *  it (`{"status":200,"txStatus":"SEEN_ON_NETWORK","txid":"…"}`). Reading only
 *  the first shape threw away a transaction the network had already accepted
 *  and would have inscribed it a second time on the next run. */
export function txidFromBroadcast(body) {
  const bare = body.trim().replace(/^"+|"+$/g, "");
  if (/^[0-9a-fA-F]{64}$/.test(bare)) return bare.toLowerCase();
  try {
    const parsed = JSON.parse(body);
    const txid = parsed?.txid ?? parsed?.data?.txid;
    if (typeof txid === "string" && /^[0-9a-fA-F]{64}$/.test(txid.trim())) {
      // A status object that names a transaction but reports a rejection is
      // not a success: only an accepted one carries the id forward.
      const status = String(parsed?.txStatus ?? parsed?.status ?? "");
      if (/^(REJECTED|ERROR)$/i.test(status)) return null;
      return txid.trim().toLowerCase();
    }
  } catch { /* not JSON: fall through to no id */ }
  return null;
}

/** Broadcast a signed transaction, alternating processors and waiting out a
 *  rate limit. Returns the transaction id. Any answer that is not a rate
 *  limit fails immediately: a rejected transaction is not retryable, and
 *  sending it again would only ask a second processor to reject it too. */
export async function broadcastRaw(hex, { fetchImpl = fetch, sleep = wait, log = console.log } = {}) {
  let last = "";
  for (let attempt = 0; attempt <= BROADCAST_BACKOFF_MS.length; attempt++) {
    const endpoint = BROADCAST_ENDPOINTS[attempt % BROADCAST_ENDPOINTS.length];
    const resp = await fetchImpl(`${endpoint}/tx/raw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txhex: hex }),
    });
    const body = await resp.text();
    const txid = txidFromBroadcast(body);
    if (txid) return txid;
    last = body.trim().replace(/^"+|"+$/g, "");
    const rateLimited = resp.status === 429 || /too many requests/i.test(body);
    if (!rateLimited || attempt === BROADCAST_BACKOFF_MS.length) break;
    const pause = BROADCAST_BACKOFF_MS[attempt];
    log(`broadcast rate-limited by ${new URL(endpoint).host}; waiting ${pause}ms and trying ${new URL(BROADCAST_ENDPOINTS[(attempt + 1) % BROADCAST_ENDPOINTS.length]).host}`);
    await sleep(pause);
  }
  throw new Error(`broadcast failed: ${last}`);
}

/** The change output a follow-up inscription can spend, or -1. */
export function changeOutputIndex(tx) {
  return tx.outputs.findIndex((o) => o.change === true && (o.satoshis ?? 0) > 0);
}

// Where the input comes from, in order of preference: the previous
// transaction in this run (its change is not yet indexed anywhere else), a
// fake output on a dry run, or the largest spendable output the indexer
// reports for the key's address.
async function sourceFor({ address, prevTx, dryRun, fetchImpl, sleep = wait, log = console.log }) {
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
  let result;
  try {
    ({ result } = JSON.parse(await fetchIndexer(`/address/${address}/unspent/all`, { fetchImpl, sleep, log })));
  } catch (e) {
    throw new Error(`fetching unspent outputs for ${address} failed: ${e.message}`);
  }
  const spendable = (Array.isArray(result) ? result : []).filter((u) => !u.isSpentInMempoolTx);
  if (spendable.length === 0) {
    throw new Error(`no spendable outputs for ${address} — the archive key is unfunded, or its change is still propagating`);
  }
  const utxo = spendable.reduce((largest, u) => (u.value > largest.value ? u : largest));
  let hex;
  try {
    hex = (await fetchIndexer(`/tx/${utxo.tx_hash}/hex`, { fetchImpl, sleep, log })).trim();
  } catch (e) {
    throw new Error(`fetching source tx ${utxo.tx_hash} failed: ${e.message}`);
  }
  return {
    sourceTransaction: Transaction.fromHex(hex),
    sourceOutputIndex: utxo.tx_pos,
    sourceLabel: `utxo ${utxo.tx_hash}:${utxo.tx_pos}`,
  };
}

/** Seal, envelope, build, fee, guard, sign, and (unless dryRun) broadcast.
 *  Returns the transaction so the next inscription in a run can spend its
 *  change in process, plus what a caller needs to log and index. */
export async function inscribeDocument({
  wif, keyHex, surface, date, bytes, previousTxid = "", prevTx = null,
  feeCeiling = FEE_CEILING_SATS, dryRun = false, fetchImpl = fetch, log = console.log, sleep = wait,
}) {
  const key = PrivateKey.fromWif(wif);
  const address = key.toAddress();
  const sealed = sealPayload(bytes, keyHex);
  const chunks = buildEnvelope({ surface, date, keyId: keyIdentifier(keyHex), previousTxid, sealed });

  const { sourceTransaction, sourceOutputIndex, sourceLabel } = await sourceFor({ address, prevTx, dryRun, fetchImpl, sleep, log });
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
  if (fee > feeCeiling) {
    throw new Error(`refusing to sign: computed fee ${fee} satoshis exceeds the ${feeCeiling}-satoshi ceiling (input ${inputValue} satoshis)`);
  }
  await tx.sign();

  const summary = { tx, fee, change: change.satoshis, payloadBytes: sealed.length, sourceLabel, txid: null };
  if (dryRun) {
    log(`dry-run ${surface} ${date}: fee ${fee} satoshis, change ${change.satoshis} satoshis (input ${inputValue} satoshis, ${sealed.length}-byte payload, source: ${sourceLabel}) — not broadcast`);
    return summary;
  }

  summary.txid = await broadcastRaw(tx.toHex(), { fetchImpl, sleep, log });
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
