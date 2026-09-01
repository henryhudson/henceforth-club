// Weekly runner: load the week's daily reports + the board, optionally pull App Store
// Connect sales, assemble the weeks/<date>.json artifact, and write it.
// The pure `assemble` is unit-tested; the file/network paths run via the /whh command.

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { windowDates, buildRetro, weekStripDates, buildWeekStrip, weekPlanSkeleton, addDays } from "./whh-aggregate.mjs";
import { attachWeekToBoardFiles } from "./local-mirror.mjs";
import { pullSales } from "./asc-client.mjs";
import { pullAnalyticsDownloads } from "./asc-analytics.mjs";
import { pullAppState } from "./app-state.mjs";

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, "content/board/reports");
const WEEKS_DIR = path.join(ROOT, "content/board/weeks");
const LATEST = path.join(ROOT, "content/board/latest.json");
const NAMES = { henceforth: "Henceforth", deck: "DaDeckOfCards", hansard: "Hansard" };
const APP_IDS = { henceforth: "1602896145", deck: "1520654142", hansard: "6762037651" };

/** Pure: assemble a WeekReport from already-loaded inputs. */
export function assemble({ endDate, days = 7, reports, board, sales, generatedAt, weekStrip, appState }) {
  const dates = windowDates(endDate, days);
  // weekOf/weekEnd label the REVIEWED window (the trailing `days` ending endDate) —
  // this is a retrospective, so its header and every figure (reviews, sales,
  // downloads) are about that finished week. On the Saturday cadence the window
  // is exactly the completed Sun..Sat week.
  const retro = buildRetro({ reports, board, windowStart: dates[0] });
  retro.weekStrip = weekStrip ?? [];
  // The weekPlan alone looks FORWARD: anchoring on endDate + 1 rolls a Saturday
  // run into next week, while Sunday/mid-week runs plan the week they fall in.
  retro.weekPlan = weekPlanSkeleton(addDays(endDate, 1));
  retro.appState = appState ?? [];
  return {
    weekOf: dates[0], weekEnd: endDate, generatedAt,
    daysCovered: reports.map((r) => r.date),
    retro,
    sales: sales ?? { window: null, perApp: [], drivers: [], note: "App Store Connect not configured — sales half skipped." },
  };
}

async function loadReports(endDate, days) {
  const wanted = new Set(windowDates(endDate, days));
  const files = (await readdir(REPORTS_DIR)).filter((f) => f.endsWith(".json"));
  const reports = [];
  for (const f of files) {
    const date = f.replace(/\.json$/, "");
    if (wanted.has(date)) reports.push(JSON.parse(await readFile(path.join(REPORTS_DIR, f), "utf8")));
  }
  return reports.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function ascFromEnv() {
  const { ASC_ISSUER_ID, ASC_KEY_ID, ASC_KEY_PATH, ASC_VENDOR_NUMBER } = process.env;
  if (!ASC_ISSUER_ID || !ASC_KEY_ID || !ASC_KEY_PATH || !ASC_VENDOR_NUMBER) return null;
  return { appSkus: { henceforth: [process.env.ASC_SKU_HENCEFORTH], deck: [process.env.ASC_SKU_DECK], hansard: [process.env.ASC_SKU_HANSARD] } };
}

export async function run({ endDate, days = 7 }) {
  const reports = await loadReports(endDate, days);
  const board = JSON.parse(await readFile(LATEST, "utf8"));
  const reviewsByDate = {};
  for (const d of weekStripDates(endDate)) {
    try {
      const r = JSON.parse(await readFile(path.join(REPORTS_DIR, `${d}.json`), "utf8"));
      reviewsByDate[d] = Number(r.summary?.reviews ?? 0);
    } catch { /* no report that day */ }
  }
  const weekStrip = buildWeekStrip(reviewsByDate, endDate);
  const ascCfg = ascFromEnv();
  let sales = null;
  if (ascCfg) {
    const all14 = windowDates(endDate, 14); // this week = last 7, last week = the 7 before
    const thisDates = all14.slice(7), lastDates = all14.slice(0, 7);
    const pem = await readFile(process.env.ASC_KEY_PATH, "utf8");
    const creds = { issuerId: process.env.ASC_ISSUER_ID, keyId: process.env.ASC_KEY_ID, privateKeyPem: pem, vendorNumber: process.env.ASC_VENDOR_NUMBER };
    // Prefer App Analytics (the App Store Connect dashboard's own download source); fall back to the
    // Sales report estimate until Apple has generated the analytics instances for the ongoing requests.
    const reqIds = { henceforth: process.env.ASC_ANALYTICS_REQ_HENCEFORTH, deck: process.env.ASC_ANALYTICS_REQ_DECK, hansard: process.env.ASC_ANALYTICS_REQ_HANSARD };
    if (reqIds.henceforth && reqIds.deck && reqIds.hansard) {
      try { sales = await pullAnalyticsDownloads({ creds, requestIds: reqIds, names: NAMES, thisDates, lastDates }); }
      catch { sales = null; }
    }
    if (!sales) {
      sales = await pullSales({ creds, appSkus: ascCfg.appSkus, names: NAMES, thisDates, lastDates });
      sales.source = "Sales report estimate (App Store Connect Analytics feed still generating)";
    }
  }
  const apps = Object.keys(NAMES).map((key) => ({ key, name: NAMES[key], appId: APP_IDS[key] }));
  const appState = await pullAppState({ apps, sales });
  const week = assemble({ endDate, days, reports, board, sales, weekStrip, appState, generatedAt: new Date().toISOString() });
  await mkdir(WEEKS_DIR, { recursive: true });
  // Keyed by the review-end date (endDate), the day the retrospective was run.
  await writeFile(path.join(WEEKS_DIR, `${endDate}.json`), JSON.stringify(week, null, 2) + "\n");
  await attachWeekToBoardFiles(week);
  return week;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const endDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  run({ endDate })
    .then((w) => console.log(`wrote content/board/weeks/${endDate}.json (reviewed ${w.weekOf} → ${w.weekEnd}, plan ${w.retro.weekPlan[0]?.date} → ${w.retro.weekPlan.at(-1)?.date}) — ${w.daysCovered.length} review days${w.sales.note ? " (sales skipped)" : ""}`))
    .catch((e) => { console.error(e); process.exit(1); });
}
