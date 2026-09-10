// App Store Connect App Analytics reader — pulls the "App Downloads Standard" report (the same
// download source the App Store Connect dashboard uses) and sums downloads per app over a window.
// Falls back to null when Apple has not generated the report instances yet (a new ongoing report
// request takes a day or two), so the caller can use the Sales-report estimate meanwhile.
//
// Apple delivers a report as a stream of overlapping daily instances, and a later instance
// restates earlier dates with revised counts. This reader therefore folds EVERY recent instance
// through the same merge and coverage rules the daily reach uses (daily-reach-core.mjs) rather
// than reading one instance and calling the rest zero — the fault that had the weekly review
// report 17 downloads for a week the daily reader had already counted at 38.

import { mintJWT, delta } from "./asc-client.mjs";
import { coverageThrough, mergeByDate } from "./daily-reach-core.mjs";
import { gunzipSync } from "node:zlib";

const BASE = "https://api.appstoreconnect.apple.com/v1";

/** How many daily instances to fold. Apple packs two to three days into each, so sixteen cover
 *  the fourteen days of the two windows with the same margin the daily reader keeps over its
 *  seven (eight instances). Reading too few would leave the older window short of history and
 *  read its unwritten days as zeros. */
const TAKE_INSTANCES = 16;

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

/** Pure: this week's and last week's downloads over the SAME positions of the two windows,
 *  limited to the dates Apple has processed.
 *
 *  The windows are aligned day for day — lastDates[i] is thisDates[i] a week earlier — so a
 *  position beyond coverage is dropped from BOTH. Measuring a short week against a full one
 *  would report a fall that is only Apple's lag; dropping the position from both compares like
 *  with like, at the cost of a shorter comparison the caller announces through `dataThrough`.
 *
 *  A date inside coverage that the merged map holds no row for is a real zero: Apple writes a
 *  row only for a date that had downloads. A window with no covered date at all is unknown, and
 *  unknown is null, never zero — the distinction the weekly review used to lose, printing an
 *  unprocessed week as a flat 0 beside a real one. */
export function unitsOverWindows(merged, through, thisDates, lastDates) {
  const covered = through ? thisDates.map((_, i) => i).filter((i) => thisDates[i] <= through) : [];
  if (!covered.length) return { thisWeek: null, lastWeek: null, deltaPct: null };
  const sum = (dates) => covered.reduce((n, i) => n + (merged[dates[i]] ?? 0), 0);
  const thisWeek = sum(thisDates), lastWeek = sum(lastDates);
  return { thisWeek, lastWeek, deltaPct: delta(thisWeek, lastWeek) };
}

async function jget(url, jwt, fetchImpl) {
  const r = await fetchImpl(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!r.ok) throw new Error(`${url.split("?")[0]} ${r.status}`);
  return r.json();
}

/** The newest daily instances of one request's App Downloads Standard report, each folded into
 *  downloads per date. Empty when Apple has generated none yet, so the caller can tell an app
 *  with no data from an app with no downloads. */
async function downloadInstances({ jwt, requestId, fetchImpl, take = TAKE_INSTANCES }) {
  const reports = [];
  let next = `${BASE}/analyticsReportRequests/${requestId}/reports?limit=200`;
  while (next) { const j = await jget(next, jwt, fetchImpl); reports.push(...(j.data ?? [])); next = j.links?.next; }
  const report = reports.find((r) => r.attributes?.name === "App Downloads Standard");
  if (!report) return [];
  const all = (await jget(`${BASE}/analyticsReports/${report.id}/instances?limit=200`, jwt, fetchImpl)).data ?? [];
  const daily = all.filter((i) => i.attributes?.granularity === "DAILY");
  const inst = (daily.length ? daily : all)
    .sort((a, b) => (a.attributes.processingDate < b.attributes.processingDate ? 1 : -1))
    .slice(0, take);
  return Promise.all(inst.map(async (i) => {
    const segs = (await jget(`${BASE}/analyticsReportInstances/${i.id}/segments`, jwt, fetchImpl)).data ?? [];
    const byDate = {};
    for (const s of segs) {
      const buf = Buffer.from(await (await fetchImpl(s.attributes.url)).arrayBuffer());
      let csv;
      try { csv = gunzipSync(buf).toString("utf8"); } catch { csv = buf.toString("utf8"); }
      for (const [date, n] of Object.entries(parseDownloadsCsv(csv))) byDate[date] = (byDate[date] ?? 0) + n;
    }
    return { processingDate: i.attributes.processingDate, byDate };
  }));
}

/** Per-app downloads this-week vs last-week from App Analytics (the dashboard's source).
 *  Returns null when no app has generated data yet, so the caller falls back to the Sales report.
 *  `dataThrough` is the newest day any app's report reaches, for the edition's note. */
export async function pullAnalyticsDownloads({ creds, requestIds, names, thisDates, lastDates, fetchImpl = fetch }) {
  const jwt = mintJWT(creds);
  const perApp = [];
  const throughs = [];
  for (const [app, requestId] of Object.entries(requestIds)) {
    let instances = [];
    try { instances = await downloadInstances({ jwt, requestId, fetchImpl }); } catch { instances = []; }
    const through = coverageThrough(instances);
    if (through) throughs.push(through);
    perApp.push({
      app, name: names[app] ?? app,
      units: unitsOverWindows(mergeByDate(instances), through, thisDates, lastDates),
      proceeds: { thisWeek: 0, lastWeek: 0, currency: null, deltaPct: 0 },
    });
  }
  if (!throughs.length) return null;
  return {
    window: { thisWeek: thisDates[thisDates.length - 1], lastWeek: lastDates[lastDates.length - 1] },
    dataThrough: throughs.reduce((a, b) => (a > b ? a : b)),
    perApp, drivers: [], source: "App Analytics",
  };
}
