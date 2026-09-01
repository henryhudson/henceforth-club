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
//       fake 10,000-satoshi source, same pinned 100 sat/kb fee as live, never broadcast)
//
// RENDER_PDF_BASE overrides the site origin (default https://www.henceforth.club).
// For pre-merge verification, point it at a local production server, e.g.
// RENDER_PDF_BASE=http://localhost:3111, so the render exercises the branch's
// own print stylesheet instead of the live site (which doesn't have it yet).
import puppeteer from "puppeteer-core";
import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { Redis } from "@upstash/redis";
import { changeOutputIndex, inscribeDocument } from "./chain-put.mjs";
import { editionSurface } from "./chain-publish-core.mjs";
import { inscribeHeadFor, readLedger, recordInscription } from "./chain-publish.mjs";

// The publisher's ledger of everything on the chain; an edition joins it the
// moment it is broadcast, and the head inscribed right after names it. The
// store's board:pdftx index is written too, until task six retires it.
const LEDGER = join(process.cwd(), "content/board/.chain-ledger.json");

const SITE = process.env.RENDER_PDF_BASE ?? "https://www.henceforth.club";
const SITE_HOST = new URL(SITE).hostname;
// One sheet each, on the newspaper measure: the daily since its re-cut on
// 2026-08-20, the weekly since its own re-cut proved one page on 2026-08-21.
// A second page means the sheet's fit loop failed — tighten the sheet, never
// raise the number; the render must fail loudly. (History: the daily ran two
// pages 2026-08-04 to 2026-08-19, when the report was set at book size.)
const BUDGET = { daily: 1, week: 1 };
// The transaction itself — sealing, the envelope, the fee, the guard that no
// transaction is ever broadcast whose only output is data, signing and the
// broadcast — lives in chain-put.mjs, shared with every surface that goes on
// the chain. This script renders, holds the page budget, and indexes.

function mintSession(secret, ttlMs = 10 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

let redisClient;
function getRedisClient() {
  if (redisClient) return redisClient;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = new Redis({ url, token });
  return redisClient;
}

// Indexes one inscription; the transaction itself is chain-put.mjs. Returns
// the broadcast Transaction so the NEXT inscription in the same run can spend
// its change output in process — re-fetching UTXOs between jobs would either
// double-spend (stale list) or miss the just-created change (not yet indexed).
async function inscribe(kind, date, pdf, prevTx, dryRun) {
  // One inscription per edition, ever. A date that already carries a
  // transaction is done — a re-run refreshes the local copy and stops here,
  // so a same-day follow-up (or an accidental bare re-render of a past date)
  // can never inscribe twice and spend twice. Fails open only if the index
  // read itself fails: an unreadable index must not block the day's first
  // genuine inscription, and the index write at the end already warns loudly
  // when it cannot record one.
  const surface = editionSurface(kind, date);
  const ledger = await readLedger(LEDGER).catch(() => ({ surfaces: {}, head: null }));
  const existing = ledger.surfaces[surface]?.txid
    ?? (await getRedisClient().get(`board:pdftx:${kind}:${date}`).catch(() => null));
  if (existing && !dryRun) {
    console.log(`${kind} ${date} is already inscribed (${existing}) — inscription skipped, local copy refreshed`);
    return null;
  }
  if (existing) console.log(`${kind} ${date} is already inscribed (${existing}) — dry run prices it again anyway`);
  const out = await inscribeDocument({
    wif: process.env.BOARD_ARCHIVE_WIF,
    keyHex: process.env.BOARD_ARCHIVE_KEY,
    surface: `${kind}-edition`,
    date,
    bytes: Buffer.from(pdf),
    prevTx,
    dryRun,
  });
  if (!dryRun) {
    // The ledger is the record now: written before anything that can fail
    // over the network, so the inscription (already paid for) is never
    // orphaned. The head inscribed next names it for every reader.
    await recordInscription({ ledgerPath: LEDGER, surface, txid: out.txid, bytes: pdf, date });
  }
  const head = await inscribeHeadFor({
    ledgerPath: LEDGER,
    wif: process.env.BOARD_ARCHIVE_WIF,
    keyHex: process.env.BOARD_ARCHIVE_KEY,
    date,
    also: { [surface]: out.txid ?? out.tx.id("hex") },
    prevTx: out.tx,
    dryRun,
  });
  if (dryRun) return head.tx;

  // The store's index stays written through the transition; a refusal is a
  // warning, not a failure — the ledger and the head already carry the record.
  try {
    await getRedisClient().set(`board:pdftx:${kind}:${date}`, out.txid);
  } catch (e) {
    console.warn(`board:pdftx:${kind}:${date} not written to the store (${e.message}); the ledger and the head carry it`);
  }
  return head.tx; // the next job chains off the head's change
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

  // The local copy is written BEFORE the budget check: when the fit loop loses,
  // the failed sheet must exist on disk to be opened and diagnosed. Only the
  // free local write moves ahead of the throw — the archive and the inscription
  // stay strictly behind it (money must stay behind the check).
  const localPath = outPath ?? join(tmpdir(), `board-${kind}-${date}.pdf`);
  await writeFile(localPath, pdf);

  const pages = (await PDFDocument.load(pdf)).getPageCount();
  if (pages > BUDGET[kind]) {
    try { execSync(`open ${JSON.stringify(localPath)}`); } catch { /* open is best-effort */ }
    throw new Error(`${kind} ${date}: ${pages} pages exceeds the budget of ${BUDGET[kind]} — tighten the print stylesheet, do not skip (over-budget sheet at ${localPath})`);
  }
  // Every render also lands a permanent copy in the editions archive (Henry,
  // 2026-08-20: "ensure we are saving all this in folders for future
  // reference") — the chain holds the inscribed record, the folder holds the
  // browsable one. Best-effort: an archive failure never blocks the render.
  try {
    const archiveDir = join(homedir(), "Henceforth", "editions", kind);
    await mkdir(archiveDir, { recursive: true });
    await writeFile(join(archiveDir, `${date}.pdf`), pdf);
  } catch (e) {
    console.warn(`editions archive copy failed (render unaffected): ${e.message}`);
  }
  // Blocking open so it launches before the process exits (a fire-and-forget
  // child gets orphaned on exit and never surfaces the window); best-effort so
  // a headless environment can't fail the render.
  try { execSync(`open ${JSON.stringify(localPath)}`); } catch { /* open is best-effort */ }
  if (outPath) {
    console.log(`wrote ${outPath} (${pages} page${pages === 1 ? "" : "s"}, ${pdf.length} bytes) — opened; inscription skipped`);
    return null;
  }
  console.log(`wrote + opened ${localPath} (${pages} page${pages === 1 ? "" : "s"}) — inscribing…`);
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
