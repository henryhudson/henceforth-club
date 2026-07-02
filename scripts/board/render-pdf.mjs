// Render board report editions to A4 PDFs with the locally installed Chrome,
// enforce the page budget, and inscribe them as encrypted BSV transactions.
// Publish FIRST, render SECOND — this reads the LIVE pages.
//
// Usage (from henceforth-club):
//   node --env-file=.env.local scripts/board/render-pdf.mjs daily 2026-07-02
//   node --env-file=.env.local scripts/board/render-pdf.mjs daily 2026-07-02 week 2026-06-29
//   node --env-file=.env.local scripts/board/render-pdf.mjs --all
//   ... daily 2026-07-02 --out /tmp/daily.pdf   (local file, no inscription)
//   ... daily 2026-07-02 week 2026-06-29 --dry-run   (build+fee+sign against a
//       fake 10,000-satoshi source, deterministic 1 sat/kb fee, never broadcast)
//
// RENDER_PDF_BASE overrides the site origin (default https://www.henceforth.club).
// For pre-merge verification, point it at a local production server, e.g.
// RENDER_PDF_BASE=http://localhost:3111, so the render exercises the branch's
// own print stylesheet instead of the live site (which doesn't have it yet).
import puppeteer from "puppeteer-core";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { Redis } from "@upstash/redis";
import { LockingScript, OP, P2PKH, PrivateKey, SatoshisPerKilobyte, Transaction, Utils } from "@bsv/sdk";

const SITE = process.env.RENDER_PDF_BASE ?? "https://www.henceforth.club";
const SITE_HOST = new URL(SITE).hostname;
const BUDGET = { daily: 1, week: 2 };
// Keep in sync with src/lib/board-pdf-crypto.ts (the script cannot import TypeScript).
const INSCRIPTION_MARKER = "HHRPT1";
// Expected daily fee is ~60 satoshis; this is generous headroom. The sdk's
// Transaction.fee() silently DELETES the change output when change <= 0, so
// without the assertions below a pathological fee rate or a low-balance key
// would burn the whole input as miner fee. Never broadcast a transaction
// whose only output is the OP_RETURN.
const FEE_CEILING_SATS = 5000;

function mintSession(secret, ttlMs = 10 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// Mirrors src/lib/board-pdf-crypto.ts encryptPdf — node:crypto aes-256-gcm,
// nonce = randomBytes(12), payload = nonce ‖ tag ‖ ciphertext.
function encryptPdf(pdf, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(pdf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, tag, ciphertext]);
}

let redisClient;
function getRedisClient() {
  if (redisClient) return redisClient;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = new Redis({ url, token });
  return redisClient;
}

/** The change output a follow-up inscription can spend, or -1. */
function changeOutputIndex(tx) {
  return tx.outputs.findIndex((o) => o.change === true && (o.satoshis ?? 0) > 0);
}

// Builds, fees, signs, broadcasts, and indexes one inscription. Returns the
// broadcast Transaction so the NEXT inscription in the same run can spend its
// change output in process — re-fetching UTXOs between jobs would either
// double-spend (stale list) or miss the just-created change (not yet indexed).
async function inscribe(kind, date, pdf, prevTx, dryRun) {
  const key = PrivateKey.fromWif(process.env.BOARD_ARCHIVE_WIF);
  const address = key.toAddress();
  const payload = encryptPdf(Buffer.from(pdf), process.env.BOARD_ARCHIVE_KEY);

  let sourceTransaction;
  let sourceOutputIndex;
  let sourceLabel;
  if (prevTx) {
    const changeIndex = changeOutputIndex(prevTx);
    if (changeIndex < 0) throw new Error("previous transaction in this run has no change output to chain from");
    sourceTransaction = prevTx;
    sourceOutputIndex = changeIndex;
    sourceLabel = "previous transaction's change";
  } else if (dryRun) {
    sourceTransaction = new Transaction();
    sourceTransaction.addOutput({ lockingScript: new P2PKH().lock(address), satoshis: 10_000 });
    sourceOutputIndex = 0;
    sourceLabel = "fake 10000-satoshi utxo";
  } else {
    // Mempool-inclusive endpoint (the plain /unspent one is deprecated and
    // confirmed-only, which hides freshly broadcast change). Response shape:
    // { address, script, result: [{ height, tx_pos, tx_hash, value,
    //   isSpentInMempoolTx, status }] } — verified against the live API.
    const unspentResp = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent/all`);
    if (!unspentResp.ok) throw new Error(`fetching unspent outputs for ${address} failed: ${await unspentResp.text()}`);
    const { result } = await unspentResp.json();
    const spendable = (Array.isArray(result) ? result : []).filter((u) => !u.isSpentInMempoolTx);
    if (spendable.length === 0) {
      throw new Error(
        `no spendable outputs for ${address} — either the archive key is unfunded (send a small amount of BSV first) or its change is still propagating (retry shortly)`,
      );
    }
    const utxo = spendable.reduce((largest, u) => (u.value > largest.value ? u : largest));

    const sourceHexResp = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${utxo.tx_hash}/hex`);
    if (!sourceHexResp.ok) throw new Error(`fetching source tx ${utxo.tx_hash} failed: ${await sourceHexResp.text()}`);
    sourceTransaction = Transaction.fromHex((await sourceHexResp.text()).trim());
    sourceOutputIndex = utxo.tx_pos;
    sourceLabel = `utxo ${utxo.tx_hash}:${utxo.tx_pos}`;
  }
  const inputValue = sourceTransaction.outputs[sourceOutputIndex].satoshis ?? 0;

  const tx = new Transaction();
  tx.addInput({
    sourceTransaction,
    sourceOutputIndex,
    unlockingScriptTemplate: new P2PKH().unlock(key),
  });

  const opReturn = new LockingScript()
    .writeOpCode(OP.OP_FALSE)
    .writeOpCode(OP.OP_RETURN)
    .writeBin(Utils.toArray(INSCRIPTION_MARKER, "utf8"))
    .writeBin(Utils.toArray(kind, "utf8"))
    .writeBin(Utils.toArray(date, "utf8"))
    .writeBin(Array.from(payload));
  tx.addOutput({ lockingScript: opReturn, satoshis: 0 });
  tx.addP2PKHOutput(address); // change output; sdk computes the amount via fee()

  // Dry-run pins the rate at 1 sat/kb so the numbers are deterministic and no
  // network is touched; the real path uses the sdk default (LivePolicy).
  await tx.fee(dryRun ? new SatoshisPerKilobyte(1) : undefined);

  // Guard against the sdk's silent change deletion (see FEE_CEILING_SATS note).
  const fee = tx.getFee();
  const changeOut = tx.outputs.find((o) => o.change === true && (o.satoshis ?? 0) > 0);
  if (!changeOut) {
    throw new Error(`refusing to sign: fee ${fee} satoshis would consume the entire ${inputValue}-satoshi input, leaving no change output`);
  }
  if (fee > FEE_CEILING_SATS) {
    throw new Error(`refusing to sign: computed fee ${fee} satoshis exceeds the ${FEE_CEILING_SATS}-satoshi ceiling (input ${inputValue} satoshis)`);
  }
  await tx.sign();

  if (dryRun) {
    console.log(
      `dry-run ${kind} ${date}: fee ${fee} satoshis, change ${changeOut.satoshis} satoshis ` +
        `(input ${inputValue} satoshis, ${payload.length}-byte payload, source: ${sourceLabel}) — not broadcast`,
    );
    return tx;
  }

  const broadcastResp = await fetch("https://api.whatsonchain.com/v1/bsv/main/tx/raw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txhex: tx.toHex() }),
  });
  // WhatsOnChain answers with the txid, possibly JSON-quoted — strip and normalize.
  const body = (await broadcastResp.text()).trim().replace(/^"+|"+$/g, "");
  if (!broadcastResp.ok || !/^[0-9a-fA-F]{64}$/.test(body)) {
    throw new Error(`broadcast failed: ${body}`);
  }
  const txid = body.toLowerCase(); // servePdf's index guard requires lowercase

  // Log BEFORE indexing: if the SET fails, the txid must survive on screen so
  // the inscription (already paid for) can be hand-indexed.
  console.log(`inscribed ${kind} ${date} → ${txid} (${pdf.length} bytes, fee ${fee} satoshis)`);
  try {
    await getRedisClient().set(`board:pdftx:${kind}:${date}`, txid);
  } catch (e) {
    const err = new Error(
      `broadcast succeeded but indexing failed (${e.message}) — hand-index with: SET board:pdftx:${kind}:${date} = ${txid}`,
    );
    err.tx = tx; // let the job loop keep chaining off this transaction's change
    throw err;
  }
  return tx;
}

async function render(browser, kind, date, outPath, prevTx, dryRun) {
  const path = kind === "week" ? `week/${date}` : date;
  const url = `${SITE}/board/reports/${path}`;
  const page = await browser.newPage();
  await page.setCookie({
    name: "board_session",
    value: mintSession(process.env.BOARD_COOKIE_SECRET),
    domain: SITE_HOST,
    path: "/",
    httpOnly: true,
    secure: new URL(SITE).protocol === "https:",
  });
  const resp = await page.goto(url, { waitUntil: "networkidle0", timeout: 45_000 });
  if (!resp || !resp.ok()) throw new Error(`${url} answered ${resp ? resp.status() : "nothing"} — not rendering`);
  // A stale or rotated BOARD_COOKIE_SECRET redirects here instead of failing —
  // without this guard the script would archive login-page PDFs over real editions.
  if (new URL(page.url()).pathname.startsWith("/board/login")) {
    throw new Error(`${url} bounced to the login gate — BOARD_COOKIE_SECRET in .env.local no longer matches production`);
  }
  const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
  await page.close();

  const pages = (await PDFDocument.load(pdf)).getPageCount();
  if (pages > BUDGET[kind]) {
    throw new Error(`${kind} ${date}: ${pages} pages exceeds the budget of ${BUDGET[kind]} — tighten the print stylesheet, do not skip`);
  }

  if (outPath) {
    await writeFile(outPath, pdf);
    console.log(`wrote ${outPath} (${pages} page${pages === 1 ? "" : "s"}, ${pdf.length} bytes) — inscription skipped`);
    return null;
  }
  return inscribe(kind, date, pdf, prevTx, dryRun);
}

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
if (outIdx >= 0) args.splice(outIdx, 2);
const dryIdx = args.indexOf("--dry-run");
const dryRun = dryIdx >= 0;
if (dryRun) args.splice(dryIdx, 1);

const usage = () => {
  console.error("usage: render-pdf.mjs (daily|week) YYYY-MM-DD [(daily|week) YYYY-MM-DD ...] [--out path | --dry-run] | --all");
  process.exit(1);
};

if (!process.env.BOARD_COOKIE_SECRET) { console.error("BOARD_COOKIE_SECRET missing — run with --env-file=.env.local"); process.exit(1); }
const inscribeMode = !outPath && !dryRun;
if (!outPath && (!process.env.BOARD_ARCHIVE_WIF || !process.env.BOARD_ARCHIVE_KEY)) {
  console.error("BOARD_ARCHIVE_WIF and BOARD_ARCHIVE_KEY are both required to inscribe — or pass --out for a local render");
  process.exit(1);
}
// Fail on missing redis env BEFORE any money is spent — the index SET happens
// after the broadcast, and an env explosion there would orphan the inscription.
if (
  inscribeMode &&
  !((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN))
) {
  console.error("Upstash env missing (KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN) — required to index inscriptions");
  process.exit(1);
}

const jobs = [];
if (args[0] === "--all") {
  for (const d of ((await getRedisClient().smembers("board:report:dates")) ?? []).sort()) jobs.push(["daily", d]);
  for (const w of ((await getRedisClient().smembers("board:weeks")) ?? []).sort()) jobs.push(["week", w]);
} else {
  if (args.length === 0 || args.length % 2 !== 0) usage();
  for (let i = 0; i < args.length; i += 2) {
    const [kind, date] = [args[i], args[i + 1]];
    if (!["daily", "week"].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) usage();
    jobs.push([kind, date]);
  }
}

const browser = await puppeteer.launch({ channel: "chrome", headless: true });
let failed = 0;
let prevTx = null;
try {
  for (let i = 0; i < jobs.length; i++) {
    const [kind, date] = jobs[i];
    try {
      const tx = await render(browser, kind, date, outPath, prevTx, dryRun);
      if (tx) prevTx = tx;
    } catch (e) {
      failed++;
      console.error(`FAILED ${kind} ${date}: ${e.message}`);
      if (e.tx) prevTx = e.tx;
    }
    // WhatsOnChain allows ~3 unauthenticated requests per second.
    if (inscribeMode && i < jobs.length - 1) await new Promise((r) => setTimeout(r, 400));
  }
} finally { await browser.close(); }
if (failed) { console.error(`${failed}/${jobs.length} render(s) failed`); process.exit(1); }
