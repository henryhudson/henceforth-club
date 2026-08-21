// App Store Connect client for the /whh weekly sales pull.
// Zero external dependencies: ES256 JWT via node:crypto, gzip via node:zlib.
// The network call is injected (fetchImpl) so this module is unit-testable offline.

import { createPrivateKey, sign } from "node:crypto";
import { gunzipSync } from "node:zlib";

const b64url = (buf) => Buffer.from(buf).toString("base64url");

/** Short-lived ES256 JWT for the App Store Connect API (default 20-minute expiry). */
export function mintJWT({ issuerId, keyId, privateKeyPem, now = Math.floor(Date.now() / 1000), ttl = 1200 }) {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: issuerId, iat: now, exp: now + ttl, aud: "appstoreconnect-v1" };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = sign("sha256", Buffer.from(input), { key: createPrivateKey(privateKeyPem), dsaEncoding: "ieee-p1363" });
  return `${input}.${b64url(signature)}`;
}

/** Parse an App Store Connect Sales SUMMARY report (tab-separated) into rows. */
export function parseSalesTsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const h = lines[0].split("\t");
  const at = (name) => h.indexOf(name);
  const [iSku, iTitle, iType, iUnits, iProc, iCur] = ["SKU", "Title", "Product Type Identifier", "Units", "Developer Proceeds", "Currency of Proceeds"].map(at);
  return lines.slice(1).map((line) => {
    const c = line.split("\t");
    return { sku: c[iSku], title: c[iTitle], productType: c[iType], units: Number(c[iUnits] ?? 0), proceeds: Number(c[iProc] ?? 0), currency: c[iCur] };
  });
}

/** Parse an App Store Connect SUBSCRIPTION SUMMARY report (tab-separated, version 1_4)
 *  into rows. Each row is one price/state/device slice of one subscription product;
 *  the Active columns split paying variants from free-trial variants. */
export function parseSubscriptionTsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const h = lines[0].split("\t");
  const at = (name) => h.indexOf(name);
  const PAYING = [
    "Active Standard Price Subscriptions",
    "Active Pay Up Front Introductory Offer Subscriptions",
    "Active Pay As You Go Introductory Offer Subscriptions",
    "Pay Up Front Promotional Offer Subscriptions",
    "Pay As You Go Promotional Offer Subscriptions",
    "Pay Up Front Offer Code Subscriptions",
    "Pay As You Go Offer Code Subscriptions",
    "Pay Up Front Win-back Offers",
    "Pay As You Go Win-back Offers",
  ].map(at);
  const TRIAL = [
    "Active Free Trial Introductory Offer Subscriptions",
    "Free Trial Promotional Offer Subscriptions",
    "Free Trial Offer Code Subscriptions",
    "Free Trial Win-back Offers",
  ].map(at);
  const [iApp, iDur] = ["App Apple ID", "Standard Subscription Duration"].map(at);
  const sum = (c, idxs) => idxs.reduce((n, i) => n + (i >= 0 ? Number(c[i]) || 0 : 0), 0);
  return lines.slice(1).map((line) => {
    const c = line.split("\t");
    return { appAppleId: c[iApp], duration: c[iDur], paying: sum(c, PAYING), trial: sum(c, TRIAL) };
  });
}

/** Total one app's active subscriptions: paying vs in-trial, with the paying
 *  side split by standard duration (monthly / yearly / other). */
export function sumSubscriptions(rows, appAppleId) {
  const mine = rows.filter((r) => r.appAppleId === String(appAppleId));
  const byDuration = (d) => mine.filter((r) => r.duration === d).reduce((n, r) => n + r.paying, 0);
  return {
    paying: mine.reduce((n, r) => n + r.paying, 0),
    trial: mine.reduce((n, r) => n + r.trial, 0),
    monthly: byDuration("1 Month"),
    yearly: byDuration("1 Year"),
  };
}

/** Fetch + gunzip + parse one SUBSCRIPTION SUMMARY report; 404 means the day is
 *  not processed yet (or genuinely empty) — callers step back a day and retry. */
export async function fetchSubscriptionReport({ jwt, vendorNumber, reportDate, fetchImpl = fetch }) {
  const params = new URLSearchParams({
    "filter[frequency]": "DAILY", "filter[reportType]": "SUBSCRIPTION",
    "filter[reportSubType]": "SUMMARY", "filter[vendorNumber]": vendorNumber,
    "filter[reportDate]": reportDate, "filter[version]": "1_4",
  });
  const res = await fetchImpl(`${ASC_BASE}/salesReports?${params}`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/a-gzip" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`App Store Connect salesReports (subscription) ${res.status}`);
  return parseSubscriptionTsv(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"));
}

/** A "download" row is an app install (product type 1*); updates (7*) and in-app purchases (3*) are not downloads. */
const isDownload = (r) => String(r.productType ?? "").startsWith("1");

/** Sum DOWNLOAD units + proceeds per app, keyed by configured SKUs (updates and in-app purchases excluded). */
export function sumByApp(rows, appSkus) {
  const out = {};
  for (const [app, skus] of Object.entries(appSkus)) {
    const matched = rows.filter((r) => skus.includes(r.sku) && isDownload(r));
    out[app] = {
      units: matched.reduce((n, r) => n + r.units, 0),
      proceeds: matched.reduce((n, r) => n + r.proceeds, 0),
      currency: matched[0]?.currency ?? null,
    };
  }
  return out;
}

/** Fractional week-over-week change; null when there is no baseline. */
export function delta(thisWeek, lastWeek) {
  if (lastWeek === 0) return thisWeek === 0 ? 0 : null;
  return (thisWeek - lastWeek) / lastWeek;
}

const ASC_BASE = "https://api.appstoreconnect.apple.com/v1";

/** Fetch + gunzip + parse one weekly sales report; 404 means no sales that period. */
export async function fetchSalesReport({ jwt, vendorNumber, reportDate, frequency = "WEEKLY", fetchImpl = fetch }) {
  const params = new URLSearchParams({
    "filter[frequency]": frequency, "filter[reportType]": "SALES",
    "filter[reportSubType]": "SUMMARY", "filter[vendorNumber]": vendorNumber,
    "filter[reportDate]": reportDate, "filter[version]": "1_1",
  });
  const res = await fetchImpl(`${ASC_BASE}/salesReports?${params}`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/a-gzip" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`App Store Connect salesReports ${res.status}`);
  return parseSalesTsv(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"));
}

/** Sum units + proceeds per app across a list of DAILY report dates (each report's rows span many markets). */
async function sumDailyRange({ jwt, vendorNumber, dates, appSkus, fetchImpl }) {
  const totals = {};
  for (const app of Object.keys(appSkus)) totals[app] = { units: 0, proceeds: 0, currency: null };
  for (const date of dates) {
    const rows = await fetchSalesReport({ jwt, vendorNumber, reportDate: date, frequency: "DAILY", fetchImpl });
    const day = sumByApp(rows, appSkus);
    for (const app of Object.keys(appSkus)) {
      totals[app].units += day[app].units;
      totals[app].proceeds += day[app].proceeds;
      totals[app].currency = totals[app].currency ?? day[app].currency;
    }
  }
  return totals;
}

/** Assemble the sales half from DAILY reports — this-week vs last-week units per app.
 *  Daily, not weekly: Apple's WEEKLY frequency rejects any reportDate that is not a fiscal-week-ending Sunday. */
export async function pullSales({ creds, appSkus, names, thisDates, lastDates, fetchImpl = fetch }) {
  const jwt = mintJWT(creds);
  const [a, b] = await Promise.all([
    sumDailyRange({ jwt, vendorNumber: creds.vendorNumber, dates: thisDates, appSkus, fetchImpl }),
    sumDailyRange({ jwt, vendorNumber: creds.vendorNumber, dates: lastDates, appSkus, fetchImpl }),
  ]);
  const round2 = (n) => Math.round(n * 100) / 100;
  const perApp = Object.keys(appSkus).map((app) => ({
    app, name: names[app] ?? app,
    units: { thisWeek: a[app].units, lastWeek: b[app].units, deltaPct: delta(a[app].units, b[app].units) },
    proceeds: { thisWeek: round2(a[app].proceeds), lastWeek: round2(b[app].proceeds), currency: a[app].currency ?? b[app].currency, deltaPct: delta(a[app].proceeds, b[app].proceeds) },
  }));
  return { window: { thisWeek: thisDates[thisDates.length - 1], lastWeek: lastDates[lastDates.length - 1] }, perApp, drivers: [] };
}
