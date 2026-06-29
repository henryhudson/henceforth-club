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
  const [iSku, iTitle, iUnits, iProc, iCur] = ["SKU", "Title", "Units", "Developer Proceeds", "Currency of Proceeds"].map(at);
  return lines.slice(1).map((line) => {
    const c = line.split("\t");
    return { sku: c[iSku], title: c[iTitle], units: Number(c[iUnits] ?? 0), proceeds: Number(c[iProc] ?? 0), currency: c[iCur] };
  });
}

/** Sum units + proceeds per app, keyed by configured SKUs. */
export function sumByApp(rows, appSkus) {
  const out = {};
  for (const [app, skus] of Object.entries(appSkus)) {
    const matched = rows.filter((r) => skus.includes(r.sku));
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

/** Assemble the sales half: this-week vs last-week units/proceeds per app. */
export async function pullSales({ creds, appSkus, names, thisDate, lastDate, fetchImpl = fetch }) {
  const jwt = mintJWT(creds);
  const [now, prev] = await Promise.all([
    fetchSalesReport({ jwt, vendorNumber: creds.vendorNumber, reportDate: thisDate, fetchImpl }),
    fetchSalesReport({ jwt, vendorNumber: creds.vendorNumber, reportDate: lastDate, fetchImpl }),
  ]);
  const a = sumByApp(now, appSkus), b = sumByApp(prev, appSkus);
  const perApp = Object.keys(appSkus).map((app) => ({
    app, name: names[app] ?? app,
    units: { thisWeek: a[app].units, lastWeek: b[app].units, deltaPct: delta(a[app].units, b[app].units) },
    proceeds: { thisWeek: a[app].proceeds, lastWeek: b[app].proceeds, currency: a[app].currency ?? b[app].currency, deltaPct: delta(a[app].proceeds, b[app].proceeds) },
  }));
  return { window: { thisWeek: thisDate, lastWeek: lastDate }, perApp, drivers: [] };
}
