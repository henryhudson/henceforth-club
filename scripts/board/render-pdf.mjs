// Render board report editions to A4 PDFs with the locally installed Chrome,
// enforce the page budget, and inscribe them as encrypted BSV transactions.
// Publish FIRST, render SECOND — this reads the LIVE pages.
//
// Usage (from henceforth-club):
//   node --env-file=.env.local scripts/board/render-pdf.mjs daily 2026-07-02
//   node --env-file=.env.local scripts/board/render-pdf.mjs week 2026-06-29
//   node --env-file=.env.local scripts/board/render-pdf.mjs --all
//   ... daily 2026-07-02 --out /tmp/daily.pdf   (local file, no inscription)
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
import { LockingScript, OP, P2PKH, PrivateKey, Transaction, Utils } from "@bsv/sdk";

const SITE = process.env.RENDER_PDF_BASE ?? "https://www.henceforth.club";
const SITE_HOST = new URL(SITE).hostname;
const BUDGET = { daily: 1, week: 2 };
// Keep in sync with src/lib/board-pdf-crypto.ts (the script cannot import TypeScript).
const INSCRIPTION_MARKER = "HHRPT1";

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

async function inscribe(kind, date, pdf) {
  const key = PrivateKey.fromWif(process.env.BOARD_ARCHIVE_WIF);
  const address = key.toAddress();
  const payload = encryptPdf(Buffer.from(pdf), process.env.BOARD_ARCHIVE_KEY);

  const unspentResp = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`);
  if (!unspentResp.ok) throw new Error(`fetching unspent outputs for ${address} failed: ${await unspentResp.text()}`);
  const unspent = await unspentResp.json();
  if (!Array.isArray(unspent) || unspent.length === 0) {
    throw new Error(`archive key has no funds — send a small amount of BSV to ${address} first`);
  }
  const utxo = unspent.reduce((largest, u) => (u.value > largest.value ? u : largest));

  const sourceHexResp = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${utxo.tx_hash}/hex`);
  if (!sourceHexResp.ok) throw new Error(`fetching source tx ${utxo.tx_hash} failed: ${await sourceHexResp.text()}`);
  const sourceTransaction = Transaction.fromHex((await sourceHexResp.text()).trim());

  const tx = new Transaction();
  tx.addInput({
    sourceTransaction,
    sourceOutputIndex: utxo.tx_pos,
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

  await tx.fee();
  await tx.sign();

  const broadcastResp = await fetch("https://api.whatsonchain.com/v1/bsv/main/tx/raw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txhex: tx.toHex() }),
  });
  const body = (await broadcastResp.text()).trim();
  if (!broadcastResp.ok || !/^[0-9a-f]{64}$/i.test(body)) {
    throw new Error(`broadcast failed: ${body}`);
  }
  const txid = body;

  await getRedisClient().set(`board:pdftx:${kind}:${date}`, txid);
  console.log(`inscribed ${kind} ${date} → ${txid} (${pdf.length} bytes, fee ${tx.getFee()} satoshis)`);
}

async function render(browser, kind, date, outPath) {
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
    return;
  }
  await inscribe(kind, date, pdf);
}

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
if (outIdx >= 0) args.splice(outIdx, 2);

if (!process.env.BOARD_COOKIE_SECRET) { console.error("BOARD_COOKIE_SECRET missing — run with --env-file=.env.local"); process.exit(1); }
if (!outPath && (!process.env.BOARD_ARCHIVE_WIF || !process.env.BOARD_ARCHIVE_KEY)) {
  console.error("BOARD_ARCHIVE_WIF and BOARD_ARCHIVE_KEY are both required to inscribe — or pass --out for a local render");
  process.exit(1);
}

const jobs = [];
if (args[0] === "--all") {
  for (const d of ((await getRedisClient().smembers("board:report:dates")) ?? []).sort()) jobs.push(["daily", d]);
  for (const w of ((await getRedisClient().smembers("board:weeks")) ?? []).sort()) jobs.push(["week", w]);
} else {
  const [kind, date] = args;
  if (!["daily", "week"].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
    console.error("usage: render-pdf.mjs (daily|week) YYYY-MM-DD [--out path] | --all"); process.exit(1);
  }
  jobs.push([kind, date]);
}

const browser = await puppeteer.launch({ channel: "chrome", headless: true });
let failed = 0;
try {
  for (const [kind, date] of jobs) {
    try { await render(browser, kind, date, outPath); }
    catch (e) { failed++; console.error(`FAILED ${kind} ${date}: ${e.message}`); }
  }
} finally { await browser.close(); }
if (failed) { console.error(`${failed}/${jobs.length} render(s) failed`); process.exit(1); }
