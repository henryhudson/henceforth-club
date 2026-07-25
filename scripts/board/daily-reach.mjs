// Daily reach for the /hh morning report — per-app App Store downloads by day
// (App Analytics "App Downloads Standard", ~1-day lag) plus live store ratings.
// Read-only against App Store Connect; zero new credentials (reuses the /whh key).
//
// usage: node --env-file=.env.local scripts/board/daily-reach.mjs [YYYY-MM-DD]
//   (the date is "today" for the yesterday calculation; defaults to now)

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { mintJWT } from "./asc-client.mjs";
import { parseDownloadsCsv } from "./asc-analytics.mjs";
import { fetchRatings } from "./app-state.mjs";

const BASE = "https://api.appstoreconnect.apple.com/v1";

/** Pure: overlay per-date download maps so the NEWEST instance wins each date.
 *  Apple's daily instances overlap (a late instance restates earlier dates with
 *  revised counts) — summing would double-count; last-write-wins is the truth. */
export function mergeByDate(instances) {
  const merged = {};
  for (const { byDate } of [...instances].sort((a, b) => (a.processingDate < b.processingDate ? -1 : 1))) {
    for (const [date, n] of Object.entries(byDate)) merged[date] = n;
  }
  return merged;
}

/** Pure: yesterday's count, honestly. 0 only when the data window actually covers
 *  yesterday (an absent row inside coverage IS zero); null when Apple has not
 *  processed that far yet (absence of evidence, not evidence of zero). */
export function yesterdayCount(days, dataThrough, today) {
  const y = new Date(new Date(today + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
  if (y in days) return { date: y, count: days[y] };
  return { date: y, count: dataThrough >= y ? 0 : null };
}

async function jget(url, jwt) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!r.ok) throw new Error(`${url.split("?")[0]} ${r.status}`);
  return r.json();
}

async function dailyInstances(jwt, requestId, take = 5) {
  const reports = [];
  let next = `${BASE}/analyticsReportRequests/${requestId}/reports?limit=200`;
  while (next) { const j = await jget(next, jwt); reports.push(...(j.data ?? [])); next = j.links?.next; }
  const report = reports.find((r) => r.attributes?.name === "App Downloads Standard");
  if (!report) return [];
  const inst = ((await jget(`${BASE}/analyticsReports/${report.id}/instances?limit=200`, jwt)).data ?? [])
    .filter((i) => i.attributes?.granularity === "DAILY")
    .sort((a, b) => (a.attributes.processingDate < b.attributes.processingDate ? 1 : -1))
    .slice(0, take);
  const out = [];
  for (const i of inst) {
    const segs = (await jget(`${BASE}/analyticsReportInstances/${i.id}/segments`, jwt)).data ?? [];
    const byDate = {};
    for (const s of segs) {
      const buf = Buffer.from(await (await fetch(s.attributes.url)).arrayBuffer());
      let csv;
      try { csv = gunzipSync(buf).toString("utf8"); } catch { csv = buf.toString("utf8"); }
      for (const [d, n] of Object.entries(parseDownloadsCsv(csv))) byDate[d] = (byDate[d] ?? 0) + n;
    }
    out.push({ processingDate: i.attributes.processingDate, byDate });
  }
  return out;
}

const APPS = [
  { app: "deck", name: "Deck of Cards", reqEnv: "ASC_ANALYTICS_REQ_DECK", storeId: "1520654142" },
  { app: "henceforth", name: "Henceforth", reqEnv: "ASC_ANALYTICS_REQ_HENCEFORTH", storeId: "1602896145" },
  { app: "hansard", name: "Hansard", reqEnv: "ASC_ANALYTICS_REQ_HANSARD", storeId: "6762037651" },
];

/** Site page views from the counters /api/hit has always kept (views:YYYY-MM-DD
 *  + views:total in Upstash). Unlike Apple these have no lag, and an absent day
 *  key IS a real zero — the counter has been live since launch. */
async function siteViews(today, take = 8) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const jget = async (k) => {
    const r = await fetch(`${url}/get/${k}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return 0;
    return Number((await r.json()).result) || 0;
  };
  const days = {};
  for (let i = take; i >= 1; i--) {
    const d = new Date(new Date(today + "T00:00:00Z").getTime() - i * 86400000).toISOString().slice(0, 10);
    days[d] = await jget(`views:${d}`);
  }
  const y = new Date(new Date(today + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
  return { days, yesterday: { date: y, count: days[y] ?? 0 }, total: await jget("views:total") };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const today = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const pem = readFileSync(process.env.ASC_KEY_PATH, "utf8");
  const jwt = mintJWT({ issuerId: process.env.ASC_ISSUER_ID, keyId: process.env.ASC_KEY_ID, privateKeyPem: pem });
  const perApp = [];
  for (const { app, name, reqEnv, storeId } of APPS) {
    let instances = [];
    try { instances = await dailyInstances(jwt, process.env[reqEnv]); } catch { instances = []; }
    const days = mergeByDate(instances);
    const dataThrough = instances.length ? instances[0].processingDate : null;
    const rating = await fetchRatings(storeId);
    perApp.push({ app, name, dataThrough, days, yesterday: dataThrough ? yesterdayCount(days, dataThrough, today) : { date: null, count: null }, rating });
  }
  const site = await siteViews(today);
  console.log(JSON.stringify({ today, perApp, site }, null, 1));
}
