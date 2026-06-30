// App Store Connect App Analytics reader — pulls the "App Downloads Standard" report (the same
// download source the App Store Connect dashboard uses) and sums downloads per app over a window.
// Falls back to null when Apple has not generated the report instances yet (a new ongoing report
// request takes a day or two), so the caller can use the Sales-report estimate meanwhile.

import { mintJWT } from "./asc-client.mjs";
import { gunzipSync } from "node:zlib";

const BASE = "https://api.appstoreconnect.apple.com/v1";

/** Pure: sum download Counts per date from an "App Downloads Standard" CSV (tab-separated).
 *  Counts only rows whose Download Type is a download (first-time, redownload, auto-download). */
export function parseDownloadsCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return {};
  const h = lines[0].split("\t");
  const iDate = h.indexOf("Date"), iCnt = h.indexOf("Counts"), iType = h.indexOf("Download Type");
  if (iDate < 0 || iCnt < 0) return {};
  const byDate = {};
  for (const line of lines.slice(1)) {
    const c = line.split("\t");
    if (iType >= 0 && !/download/i.test(c[iType] ?? "")) continue; // skip updates, restores, etc.
    byDate[c[iDate]] = (byDate[c[iDate]] ?? 0) + Number(c[iCnt] ?? 0);
  }
  return byDate;
}

async function jget(url, jwt, fetchImpl) {
  const r = await fetchImpl(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!r.ok) throw new Error(`${url.split("?")[0]} ${r.status}`);
  return r.json();
}

/** The latest App Downloads Standard data (downloads by date) for one report request; null if Apple
 *  has not generated any instance yet. */
async function downloadsForRequest({ jwt, requestId, fetchImpl }) {
  const reports = [];
  let next = `${BASE}/analyticsReportRequests/${requestId}/reports?limit=200`;
  while (next) { const j = await jget(next, jwt, fetchImpl); reports.push(...(j.data ?? [])); next = j.links?.next; }
  const report = reports.find((r) => r.attributes?.name === "App Downloads Standard");
  if (!report) return null;
  const inst = (await jget(`${BASE}/analyticsReports/${report.id}/instances?limit=200`, jwt, fetchImpl)).data ?? [];
  if (!inst.length) return null; // not generated yet
  const daily = inst.filter((i) => i.attributes?.granularity === "DAILY");
  const pick = (daily.length ? daily : inst).sort((a, b) => (a.attributes.processingDate < b.attributes.processingDate ? 1 : -1))[0];
  const segs = (await jget(`${BASE}/analyticsReportInstances/${pick.id}/segments`, jwt, fetchImpl)).data ?? [];
  const byDate = {};
  for (const s of segs) {
    const buf = Buffer.from(await (await fetchImpl(s.attributes.url)).arrayBuffer());
    let csv;
    try { csv = gunzipSync(buf).toString("utf8"); } catch { csv = buf.toString("utf8"); }
    for (const [date, n] of Object.entries(parseDownloadsCsv(csv))) byDate[date] = (byDate[date] ?? 0) + n;
  }
  return byDate;
}

/** Per-app downloads this-week vs last-week from App Analytics (the dashboard's source).
 *  Returns null when no app has generated data yet, so the caller falls back to the Sales report. */
export async function pullAnalyticsDownloads({ creds, requestIds, names, thisDates, lastDates, fetchImpl = fetch }) {
  const jwt = mintJWT(creds);
  const sum = (byDate, dates) => dates.reduce((n, d) => n + (byDate[d] ?? 0), 0);
  const delta = (a, b) => (b === 0 ? (a === 0 ? 0 : null) : (a - b) / b);
  const perApp = [];
  let any = false;
  for (const [app, requestId] of Object.entries(requestIds)) {
    let byDate = null;
    try { byDate = await downloadsForRequest({ jwt, requestId, fetchImpl }); } catch { byDate = null; }
    if (byDate) any = true;
    const bd = byDate ?? {};
    const tw = sum(bd, thisDates), lw = sum(bd, lastDates);
    perApp.push({
      app, name: names[app] ?? app,
      units: { thisWeek: tw, lastWeek: lw, deltaPct: delta(tw, lw) },
      proceeds: { thisWeek: 0, lastWeek: 0, currency: null, deltaPct: 0 },
    });
  }
  if (!any) return null;
  return { window: { thisWeek: thisDates[thisDates.length - 1], lastWeek: lastDates[lastDates.length - 1] }, perApp, drivers: [], source: "App Analytics" };
}
