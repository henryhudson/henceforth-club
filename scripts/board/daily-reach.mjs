// Daily reach for the /hh morning report — per-app App Store downloads by day
// (App Analytics "App Downloads Standard", ~1-day lag) plus live store ratings.
// Read-only against App Store Connect; zero new credentials (reuses the /whh key).
// Emits exactly the `Reach` block the report page consumes (src/lib/board-data.ts),
// ready to drop into the report JSON unchanged.
//
// usage: node --env-file=.env.local scripts/board/daily-reach.mjs [YYYY-MM-DD]
//   (the date is "today" for the yesterday calculation; defaults to now)

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { mintJWT, fetchSubscriptionReport, sumSubscriptions } from "./asc-client.mjs";
import { parseDownloadsCsv } from "./asc-analytics.mjs";
import { fetchRatings } from "./app-state.mjs";

const BASE = "https://api.appstoreconnect.apple.com/v1";

const daysAgo = (date, n) =>
  new Date(new Date(date + "T00:00:00Z").getTime() - n * 86400000).toISOString().slice(0, 10);
const dayBefore = (date) => daysAgo(date, 1);
const maxDate = (dates) => (dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null);

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

/** Pure: the newest day the instances actually cover. An instance processed on
 *  day D carries rows only through D−1 — its processingDate over-claims by a
 *  day (verified live: no instance holds a row dated its own processingDate) —
 *  so coverage is the newest dated row across the merged data, falling back to
 *  processingDate minus one day only when no instance carried rows at all. */
export function coverageThrough(instances) {
  return (
    maxDate(Object.keys(mergeByDate(instances))) ??
    (instances.length ? dayBefore(maxDate(instances.map((i) => i.processingDate))) : null)
  );
}

/** Pure: yesterday's count, honestly. 0 only when the data window actually covers
 *  yesterday (an absent row inside coverage IS zero); null when Apple has not
 *  processed that far yet (absence of evidence, not evidence of zero). */
export function yesterdayCount(days, dataThrough, today) {
  const y = dayBefore(today);
  if (y in days) return { date: y, count: days[y] };
  return { date: y, count: dataThrough >= y ? 0 : null };
}

/** Pure: read one Upstash GET response honestly. A non-ok response is not a
 *  count — an authorisation failure must never render as zero — while a 200
 *  whose result is null is a key that was never written: a real zero. */
export function readCounter(ok, body) {
  if (!ok) return null;
  if (body?.result == null) return 0;
  return Number(body.result) || 0;
}

/** Pure: keep only the trailing seven days ending at `through`. The shape's
 *  name is `week` and the report page renders it as one — but an Apple report
 *  instance can restate FULL history in a single delivery (observed live
 *  2026-08-11: one instance carried every date since January, ballooning the
 *  map to ~220 entries), so the window is enforced here rather than trusted. */
export function onlyTrailingWeek(days, through) {
  if (!through) return days;
  const floor = daysAgo(through, 6);
  return Object.fromEntries(Object.entries(days).filter(([date]) => date >= floor && date <= through));
}

/** Pure: assemble the report page's `Reach` shape (src/lib/board-data.ts) —
 *  top-level dataThrough, per-app week maps, site totals. */
export function buildReach(today, apps, site) {
  const entries = apps.map(({ app, instances, rating }) => {
    const merged = mergeByDate(instances);
    const through = coverageThrough(instances);
    const week = onlyTrailingWeek(merged, through);
    const yesterday = through ? yesterdayCount(merged, through, today) : { date: null, count: null };
    return { through, entry: { app, yesterday, week, rating } };
  });
  return {
    dataThrough: maxDate(entries.map((e) => e.through).filter((d) => d != null)),
    perApp: entries.map((e) => e.entry),
    ...(site ? { site } : {}),
  };
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
  { app: "deck", reqEnv: "ASC_ANALYTICS_REQ_DECK", storeId: "1520654142" },
  { app: "henceforth", reqEnv: "ASC_ANALYTICS_REQ_HENCEFORTH", storeId: "1602896145" },
  { app: "hansard", reqEnv: "ASC_ANALYTICS_REQ_HANSARD", storeId: "6762037651" },
];

/** Deck's active subscriptions (paying vs trial, monthly vs yearly) from the
 *  SUBSCRIPTION daily report. Apple lags a day and sometimes two, so walk back
 *  from yesterday until a report answers; null when none of the window has one
 *  (absence of the report, never presented as zero subscribers). */
async function deckSubscriptions(jwt, today, back = 3) {
  for (let i = 1; i <= back; i++) {
    const reportDate = daysAgo(today, i);
    try {
      const rows = await fetchSubscriptionReport({
        jwt, vendorNumber: process.env.ASC_VENDOR_NUMBER, reportDate,
      });
      if (rows.length) return { date: reportDate, ...sumSubscriptions(rows, "1520654142") };
    } catch { /* auth or transport failure: fall through to older days, then null */ }
  }
  return null;
}

/** Site page views from the counters /api/hit has always kept (views:YYYY-MM-DD
 *  + views:total in Upstash). Unlike Apple these have no lag, and an absent day
 *  key IS a real zero — the counter has been live since launch. A failed read is
 *  different: null, never zero — and without a real total, no site block at all. */
/** Pure: the week's views, or null when any day's read was refused. Summing
 *  around a refusal would manufacture a smaller week and present it as fact —
 *  observed live on 2026-08-29, when two pulls minutes apart read 13, then 0. */
export function siteWeek(counts) {
  return counts.some((n) => n == null) ? null : counts.reduce((sum, n) => sum + n, 0);
}

async function siteViews(today, take = 7) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const read = async (k) => {
    const r = await fetch(`${url}/get/${k}`, { headers: { Authorization: `Bearer ${token}` } });
    return readCounter(r.ok, r.ok ? await r.json() : null);
  };
  const counts = [];
  for (let i = take; i >= 1; i--) counts.push(await read(`views:${daysAgo(today, i)}`));
  const total = await read("views:total");
  if (total == null) return null;
  return {
    yesterday: counts.at(-1) ?? null,
    week: siteWeek(counts),
    total,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const today = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const pem = readFileSync(process.env.ASC_KEY_PATH, "utf8");
  const jwt = mintJWT({ issuerId: process.env.ASC_ISSUER_ID, keyId: process.env.ASC_KEY_ID, privateKeyPem: pem });
  const apps = [];
  for (const { app, reqEnv, storeId } of APPS) {
    let instances = [];
    try { instances = await dailyInstances(jwt, process.env[reqEnv]); } catch { instances = []; }
    apps.push({ app, instances, rating: await fetchRatings(storeId) });
  }
  const reach = buildReach(today, apps, await siteViews(today));
  const subs = await deckSubscriptions(jwt, today);
  if (subs) {
    const deck = reach.perApp.find((a) => a.app === "deck");
    if (deck) deck.subscriptions = subs;
  }
  console.log(JSON.stringify(reach, null, 1));
}
