// The funnel behind the downloads: pure functions over the rows of the App
// Analytics reports the morning reach reads (App Downloads Standard, App Store
// Discovery and Engagement Standard, App Store Subscription Event Report
// Standard). Every report is folded into per-date tallies, {date: {key: n}},
// so the daily rules in daily-reach.mjs (newest instance wins each date, the
// coverage rule, null beyond coverage) apply to all of them unchanged. The
// network edge stays in daily-reach.mjs; this module is tested on captured
// fixtures.

export const daysAgo = (date, n) =>
  new Date(new Date(date + "T00:00:00Z").getTime() - n * 86400000).toISOString().slice(0, 10);
export const dayBefore = (date) => daysAgo(date, 1);

export const maxDate = (dates) => (dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null);

/** Pure: overlay per-date maps so the NEWEST instance wins each date.
 *  Apple's daily instances overlap (a late instance restates earlier dates with
 *  revised counts) — summing would double-count; last-write-wins is the truth.
 *  Value-agnostic: an instance's byDate may hold plain counts (the downloads
 *  table) or per-key tallies (the funnel), and the rule is the same either way.
 *  Both readers of the App Analytics reports share this one definition — the
 *  weekly review once picked a single instance instead and undercounted a week
 *  by more than half. */
export function mergeByDate(instances) {
  const merged = {};
  for (const { byDate } of [...instances].sort((a, b) => (a.processingDate < b.processingDate ? -1 : 1))) {
    for (const [date, value] of Object.entries(byDate)) merged[date] = value;
  }
  return merged;
}

/** Pure: the newest day the instances actually cover. An instance processed on
 *  day D carries rows only through D−1 — its processingDate over-claims by a
 *  day (verified live: no instance holds a row dated its own processingDate) —
 *  but its existence proves Apple processed D−1, rows or none. So coverage is
 *  the newer of the newest dated row and the newest processingDate minus one:
 *  a newest instance that restates only older dates (a zero-download day; the
 *  Subscription Event report does this routinely, and its funnel rule skips
 *  most rows besides) must not read as Apple having stopped short. */
export function coverageThrough(instances) {
  if (!instances.length) return null;
  const processed = dayBefore(maxDate(instances.map((i) => i.processingDate)));
  const dated = maxDate(Object.keys(mergeByDate(instances)));
  return dated != null && dated > processed ? dated : processed;
}

/** Pure: keywise sum of two tallies. */
export const addTallies = (a, b) => {
  const out = { ...a };
  for (const [k, n] of Object.entries(b)) out[k] = (out[k] ?? 0) + n;
  return out;
};

/** Pure: fold one tab-separated App Analytics report into per-date tallies.
 *  `classify(get)` reads a row through its column names and answers the key
 *  the row's Counts add to, or null to skip the row. The Subscription Event
 *  report dates its rows "Event Date"; every other report says "Date". */
export function tallyByDate(text, classify, dateColumn = "Date") {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return {};
  const index = new Map(lines[0].split("\t").map((name, i) => [name, i]));
  if (!index.has(dateColumn) || !index.has("Counts")) return {};
  const out = {};
  for (const line of lines.slice(1)) {
    const cells = line.split("\t");
    const get = (name) => cells[index.get(name)] ?? "";
    const key = classify(get);
    if (key == null) continue;
    const date = get(dateColumn);
    const tally = (out[date] ??= {});
    tally[key] = (tally[key] ?? 0) + (Number(get("Counts")) || 0);
  }
  return out;
}

/** Apple's download sources, in the order the sheet reads them. */
export const SOURCE_KEYS = ["search", "browse", "referrer", "webReferrer", "other"];
const SOURCE_OF = {
  "App Store search": "search",
  "App Store browse": "browse",
  "App referrer": "referrer",
  "Web referrer": "webReferrer",
};

/** App Downloads Standard: one download by the source that brought it. A
 *  download is a first-time download or a redownload, the same rule the
 *  downloads table has always used (asc-analytics.mjs parseDownloadsCsv), so
 *  the funnel's downloads and the table's agree. Updates and restores are
 *  not downloads. */
export function classifyDownload(get) {
  if (!/download/i.test(get("Download Type"))) return null;
  return SOURCE_OF[get("Source Type")] ?? "other";
}

/** App Store Discovery and Engagement Standard: impressions and page views.
 *  Both are the report's Counts; page views span every page type (product
 *  page, store sheet, developer page). Read that way, the week of 24 to 30
 *  August gives Deck 6,562 and 136, the figures the sales brief of
 *  2026-09-07 read by hand. Taps are the step between and are not kept. */
export function classifyDiscovery(get) {
  const event = get("Event");
  if (event === "Impression") return "impressions";
  if (event === "Page view") return "pageViews";
  return null;
}

/** App Store Subscription Event Report Standard: a free trial started, a
 *  trial that became a paid subscription, or a paying subscriber lost
 *  (voluntary or billing churn from full price). A trial that ends unpaid is
 *  the gap between the first two, not a lapse; renewals and billing retries
 *  are not events of the funnel. */
export function classifySubscriptionEvent(get) {
  const group = get("Event Group");
  const name = get("Event Name");
  if (/^free trial start/i.test(name)) return "trialsStarted";
  if (group === "Paid subscription from offer") return "conversions";
  if (/churn$/i.test(group) && !/free trial/i.test(name)) return "lapsed";
  return null;
}

/** The three reports, each with its row rule. */
export const DOWNLOADS = { name: "App Downloads Standard", classify: classifyDownload, dateColumn: "Date" };
export const DISCOVERY = {
  name: "App Store Discovery and Engagement Standard",
  classify: classifyDiscovery,
  dateColumn: "Date",
};
export const SUBSCRIPTION_EVENTS = {
  name: "App Store Subscription Event Report Standard",
  classify: classifySubscriptionEvent,
  dateColumn: "Event Date",
};

/** Pure: a tally's total across its keys. */
export const totalOf = (tally) => Object.values(tally).reduce((a, b) => a + b, 0);

/** Pure: the downloads instances as the count-per-date shape buildReach has
 *  always taken: the sum of every source. */
export const downloadsOnly = (instances) =>
  instances.map(({ processingDate, byDate }) => ({
    processingDate,
    byDate: Object.fromEntries(Object.entries(byDate).map(([date, tally]) => [date, totalOf(tally)])),
  }));

/** Pure: the tallies summed over the dates `from` to `to` inclusive. A date
 *  absent from the merged map is a real zero; the caller only asks inside
 *  the report's coverage. */
export function sumWindow(merged, from, to) {
  let sum = {};
  for (let date = to; date >= from; date = dayBefore(date)) sum = addTallies(sum, merged[date] ?? {});
  return sum;
}

const rate = (numerator, denominator) => (denominator > 0 ? Math.round((numerator / denominator) * 10000) / 10000 : null);
const minDate = (a, b) => (a < b ? a : b);

/** Pure: one period of the funnel from the downloads tally and the discovery
 *  tally over the same dates. Conversion is downloads per page view, null
 *  when no page was viewed; every source key is present so a zero reads as
 *  zero. */
function funnelPeriod(downloads, discovery) {
  const pageViews = discovery.pageViews ?? 0;
  return {
    impressions: discovery.impressions ?? 0,
    pageViews,
    conversion: rate(totalOf(downloads), pageViews),
    sources: Object.fromEntries(SOURCE_KEYS.map((k) => [k, downloads[k] ?? 0])),
  };
}

/** Pure: one app's funnel, the week and yesterday, from the merged
 *  downloads and discovery tallies, each with its own coverage. The two
 *  reports lag independently, so the funnel's `through` is the older of the
 *  two and both halves are read over the same dates. Null when either report
 *  has no coverage at all; yesterday null when the coverage stops short of it. */
export function buildFunnel(today, downloads, discovery) {
  if (!downloads.through || !discovery.through) return null;
  const through = minDate(downloads.through, discovery.through);
  const week = funnelPeriod(
    sumWindow(downloads.merged, daysAgo(through, 6), through),
    sumWindow(discovery.merged, daysAgo(through, 6), through),
  );
  const y = dayBefore(today);
  const yesterday =
    through >= y ? funnelPeriod(downloads.merged[y] ?? {}, discovery.merged[y] ?? {}) : null;
  return { through, week, yesterday };
}

/** Pure: Deck's subscription events over the last `days` processed days:
 *  trials started, trials converted to paid, paying subscribers lapsed. Null
 *  when the report has no coverage; a day without events inside coverage is
 *  zero (Apple writes an instance only on days that had events). */
export function buildSubscriptionEvents(events, days = 28) {
  if (!events.through) return null;
  const sum = sumWindow(events.merged, daysAgo(events.through, days - 1), events.through);
  return {
    through: events.through,
    days,
    trialsStarted: sum.trialsStarted ?? 0,
    conversions: sum.conversions ?? 0,
    lapsed: sum.lapsed ?? 0,
  };
}
