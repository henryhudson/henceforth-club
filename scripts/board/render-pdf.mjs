// Render board report editions to A4 PDFs with the locally installed Chrome,
// enforce the page budget, and upload to Vercel Blob at fixed pathnames.
// Publish FIRST, render SECOND — this reads the LIVE pages.
//
// Usage (from henceforth-club):
//   node --env-file=.env.local scripts/board/render-pdf.mjs daily 2026-07-02
//   node --env-file=.env.local scripts/board/render-pdf.mjs week 2026-06-29
//   node --env-file=.env.local scripts/board/render-pdf.mjs --all
//   ... daily 2026-07-02 --out /tmp/daily.pdf   (local file, no upload)
//
// RENDER_PDF_BASE overrides the site origin (default https://www.henceforth.club).
// For pre-merge verification, point it at a local production server, e.g.
// RENDER_PDF_BASE=http://localhost:3111, so the render exercises the branch's
// own print stylesheet instead of the live site (which doesn't have it yet).
import puppeteer from "puppeteer-core";
import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { Redis } from "@upstash/redis";

const SITE = process.env.RENDER_PDF_BASE ?? "https://www.henceforth.club";
const SITE_HOST = new URL(SITE).hostname;
const BUDGET = { daily: 1, week: 2 };
// Keep in sync with src/lib/board-pdf.ts (the script cannot import TypeScript).
const blobPathname = (kind, date) => `board-pdfs/${kind}-${date}.pdf`;

function mintSession(secret, ttlMs = 10 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
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
  const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
  await page.close();

  const pages = (await PDFDocument.load(pdf)).getPageCount();
  if (pages > BUDGET[kind]) {
    throw new Error(`${kind} ${date}: ${pages} pages exceeds the budget of ${BUDGET[kind]} — tighten the print stylesheet, do not skip`);
  }

  if (outPath) {
    await writeFile(outPath, pdf);
    console.log(`wrote ${outPath} (${pages} page${pages === 1 ? "" : "s"}, ${pdf.length} bytes) — upload skipped`);
    return;
  }
  const { put } = await import("@vercel/blob");
  const blob = await put(blobPathname(kind, date), Buffer.from(pdf), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/pdf",
  });
  console.log(`uploaded ${blob.pathname} (${pages} page${pages === 1 ? "" : "s"}, ${pdf.length} bytes)`);
}

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
if (outIdx >= 0) args.splice(outIdx, 2);

if (!process.env.BOARD_COOKIE_SECRET) { console.error("BOARD_COOKIE_SECRET missing — run with --env-file=.env.local"); process.exit(1); }
if (!outPath && !process.env.BLOB_READ_WRITE_TOKEN) { console.error("BLOB_READ_WRITE_TOKEN missing — enable Blob + `vercel env pull`, or pass --out for a local render"); process.exit(1); }

const jobs = [];
if (args[0] === "--all") {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const redis = new Redis({ url, token });
  for (const d of ((await redis.smembers("board:report:dates")) ?? []).sort()) jobs.push(["daily", d]);
  for (const w of ((await redis.smembers("board:weeks")) ?? []).sort()) jobs.push(["week", w]);
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
