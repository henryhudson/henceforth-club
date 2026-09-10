// Daily reach for the /hh morning report — per-app App Store downloads by day
// (App Analytics "App Downloads Standard", ~1-day lag) plus live store ratings,
// and the funnel above the downloads: impressions, page views, conversion and
// download sources from the Discovery and Engagement report, and for Deck the
// trials started, converted and lapsed from the Subscription Event report.
// Read-only against App Store Connect; zero new credentials (reuses the /whh key).
// Emits exactly the `Reach` block the report page consumes (src/lib/board-data.ts),
// ready to drop into the report JSON unchanged.
//
// usage: node --env-file=.env.local scripts/board/daily-reach.mjs [YYYY-MM-DD]
//   (the date is "today" for the yesterday calculation; defaults to now)

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { mintJWT, fetchSubscriptionReport, sumSubscriptions } from "./asc-client.mjs";
import { fetchRatings } from "./app-state.mjs";
import {
  DISCOVERY,
  DOWNLOADS,
  SUBSCRIPTION_EVENTS,
  addTallies,
  buildFunnel,
  buildSubscriptionEvents,
  coverageThrough,
  dayBefore,
  daysAgo,
  downloadsOnly,
  maxDate,
  mergeByDate,
  tallyByDate,
} from "./daily-reach-core.mjs";

// The merge and the coverage rule live in the core so the weekly review reads
// the App Analytics instances by exactly the rules this daily reader uses.
export { coverageThrough, mergeByDate } from "./daily-reach-core.mjs";

const BASE = "https://api.appstoreconnect.apple.com/v1";

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

/** Pure: the trailing seven days ending at `through`, DENSE. Every date of the
 *  window is present, and a date the merged map holds no key for reads as the
 *  zero it is: the map gains a key only for a date whose rows the classifier
 *  answered (tallyByDate in daily-reach-core.mjs), so a day Apple processed
 *  with no downloads has no key at all, exactly like a day Apple has not
 *  processed. Density is what keeps those two apart on the sheet, because the
 *  report page reads a missing date the same way it reads a null (reachCell in
 *  report-helpers.ts prints an em dash for both): inside the window a real zero
 *  now prints as 0, and only a date beyond coverage is absent. It is the same
 *  distinction yesterdayCount already draws for the single yesterday cell.
 *
 *  The window is a ceiling too, which is why this function existed at all: an
 *  Apple report instance can restate FULL history in a single delivery
 *  (observed live 2026-08-11, when one instance carried every date since
 *  January and ballooned the map to some 220 entries), so nothing outside the
 *  window survives, and no coverage at all yields no week.
 *
 *  Note the asymmetry the coverage rule leaves: `through` is proved processed,
 *  the floor six days back is assumed so. The downloads report is read eight
 *  instances deep at two to three days each, so a week is covered with margin;
 *  a brand new app whose report holds only a day or two would read its earlier
 *  days as zeros rather than as unknowns. */
export function trailingWeek(days, through) {
  if (!through) return {};
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => daysAgo(through, 6 - i)).map((date) => [date, days[date] ?? 0]),
  );
}

/** Pure: assemble the report page's `Reach` shape (src/lib/board-data.ts) —
 *  top-level dataThrough, per-app week maps, site totals. An app's funnel
 *  (built separately, with its own coverage) rides along when there is one. */
export function buildReach(today, apps, site) {
  const entries = apps.map(({ app, instances, rating, funnel }) => {
    const merged = mergeByDate(instances);
    const through = coverageThrough(instances);
    const week = trailingWeek(merged, through);
    const yesterday = through ? yesterdayCount(merged, through, today) : { date: null, count: null };
    return { through, entry: { app, yesterday, week, rating, ...(funnel ? { funnel } : {}) } };
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

/** Every report Apple has generated under one ongoing request. */
async function reportsFor(jwt, requestId) {
  const reports = [];
  let next = `${BASE}/analyticsReportRequests/${requestId}/reports?limit=200`;
  while (next) { const j = await jget(next, jwt); reports.push(...(j.data ?? [])); next = j.links?.next; }
  return reports;
}

/** The newest `take` daily instances of one report, each folded into per-date
 *  tallies by the report's row rule (daily-reach-core.mjs). A report Apple
 *  has not generated is honestly empty. The downloads and discovery reports
 *  carry two and three days an instance, so eight instances cover a week
 *  with margin; the subscription events carry a day each and skip quiet
 *  days, so 31 instances cover 28 days. */
async function dailyInstances(jwt, reports, { name, classify, dateColumn }, take) {
  const report = reports.find((r) => r.attributes?.name === name);
  if (!report) return [];
  const inst = ((await jget(`${BASE}/analyticsReports/${report.id}/instances?limit=200`, jwt)).data ?? [])
    .filter((i) => i.attributes?.granularity === "DAILY")
    .sort((a, b) => (a.attributes.processingDate < b.attributes.processingDate ? 1 : -1))
    .slice(0, take);
  return Promise.all(inst.map(async (i) => {
    const segs = (await jget(`${BASE}/analyticsReportInstances/${i.id}/segments`, jwt)).data ?? [];
    let byDate = {};
    for (const s of segs) {
      const buf = Buffer.from(await (await fetch(s.attributes.url)).arrayBuffer());
      let csv;
      try { csv = gunzipSync(buf).toString("utf8"); } catch { csv = buf.toString("utf8"); }
      for (const [d, tally] of Object.entries(tallyByDate(csv, classify, dateColumn))) {
        byDate = { ...byDate, [d]: addTallies(byDate[d] ?? {}, tally) };
      }
    }
    return { processingDate: i.attributes.processingDate, byDate };
  }));
}

/** The merged view the funnel builders read: newest instance wins each date,
 *  and the coverage those instances actually reach. */
const merged = (instances) => ({ merged: mergeByDate(instances), through: coverageThrough(instances) });

/** One report's instances, or none when Apple refused: an unanswered report
 *  must leave the app honestly empty, never take the others down with it. */
async function instancesOrNone(jwt, reports, report, take) {
  try { return await dailyInstances(jwt, reports, report, take); } catch { return []; }
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
  let deckEvents = [];
  for (const { app, reqEnv, storeId } of APPS) {
    let reports = [];
    try { reports = await reportsFor(jwt, process.env[reqEnv]); } catch { reports = []; }
    const downloads = await instancesOrNone(jwt, reports, DOWNLOADS, 8);
    const discovery = await instancesOrNone(jwt, reports, DISCOVERY, 8);
    if (app === "deck") deckEvents = await instancesOrNone(jwt, reports, SUBSCRIPTION_EVENTS, 31);
    apps.push({
      app,
      instances: downloadsOnly(downloads),
      rating: await fetchRatings(storeId),
      funnel: buildFunnel(today, merged(downloads), merged(discovery)),
    });
  }
  const reach = buildReach(today, apps, await siteViews(today));
  // Deck's subscriptions: the standing base from the daily sales report, and
  // the movement from the Subscription Event report, two reports with their
  // own lags, each read when it answers, neither hiding the other.
  const subs = await deckSubscriptions(jwt, today);
  const events = buildSubscriptionEvents(merged(deckEvents));
  const deck = reach.perApp.find((a) => a.app === "deck");
  if (deck && (subs || events)) deck.subscriptions = { ...subs, ...(events ? { events } : {}) };
  console.log(JSON.stringify(reach, null, 1));
}
