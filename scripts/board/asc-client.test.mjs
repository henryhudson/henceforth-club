import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mintJWT, parseSalesTsv, sumByApp, delta, fetchSalesReport, pullSales } from "./asc-client.mjs";

const TSV = [
  "SKU\tTitle\tUnits\tDeveloper Proceeds\tCurrency of Proceeds",
  "HENCE01\tHenceforth\t4\t2.79\tGBP",
  "DECK01\tDeck of Cards\t1\t0.00\tGBP",
].join("\n");

describe("mintJWT", () => {
  it("produces a 3-part ES256 JWT with the right header and claims", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" });
    const jwt = mintJWT({ issuerId: "ISS", keyId: "KID12345AB", privateKeyPem: pem, now: 1000, ttl: 1200 });
    const [h, p, s] = jwt.split(".");
    expect(jwt.split(".")).toHaveLength(3);
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toMatchObject({ alg: "ES256", kid: "KID12345AB", typ: "JWT" });
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toMatchObject({ iss: "ISS", aud: "appstoreconnect-v1", iat: 1000, exp: 2200 });
    expect(Buffer.from(s, "base64url")).toHaveLength(64); // JOSE r||s, not DER
  });
});

describe("sales parsing", () => {
  it("parseSalesTsv reads units and proceeds per row", () => {
    const rows = parseSalesTsv(TSV);
    expect(rows[0]).toMatchObject({ sku: "HENCE01", units: 4, proceeds: 2.79, currency: "GBP" });
  });
  it("sumByApp totals by configured SKU", () => {
    const out = sumByApp(parseSalesTsv(TSV), { henceforth: ["HENCE01"], deck: ["DECK01"], hansard: ["HANS01"] });
    expect(out.henceforth.units).toBe(4);
    expect(out.hansard.units).toBe(0);
  });
  it("delta is fractional vs last week, null when no baseline", () => {
    expect(delta(6, 4)).toBeCloseTo(0.5);
    expect(delta(3, 0)).toBeNull();
    expect(delta(0, 0)).toBe(0);
  });
});

describe("fetchSalesReport", () => {
  it("gunzips + parses; 404 returns empty", async () => {
    const body = gzipSync(Buffer.from(TSV));
    const okFetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => body });
    const rows = await fetchSalesReport({ jwt: "x", vendorNumber: "1", reportDate: "2026-06-29", fetchImpl: okFetch });
    expect(rows[0].sku).toBe("HENCE01");
    const notFound = async () => ({ ok: false, status: 404 });
    expect(await fetchSalesReport({ jwt: "x", vendorNumber: "1", reportDate: "2026-06-29", fetchImpl: notFound })).toEqual([]);
  });
});

describe("pullSales", () => {
  it("assembles per-app units/proceeds with week-over-week deltas", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" });
    const thisTsv = ["SKU\tTitle\tUnits\tDeveloper Proceeds\tCurrency of Proceeds", "HENCE01\tHenceforth\t6\t4.00\tGBP"].join("\n");
    const lastTsv = ["SKU\tTitle\tUnits\tDeveloper Proceeds\tCurrency of Proceeds", "HENCE01\tHenceforth\t4\t2.00\tGBP"].join("\n");
    const fetchImpl = async (url) => ({ ok: true, status: 200, arrayBuffer: async () => gzipSync(Buffer.from(url.includes("2026-06-29") ? thisTsv : lastTsv)) });
    const sales = await pullSales({
      creds: { issuerId: "ISS", keyId: "KID", privateKeyPem: pem, vendorNumber: "12345678" },
      appSkus: { henceforth: ["HENCE01"] }, names: { henceforth: "Henceforth" },
      thisDate: "2026-06-29", lastDate: "2026-06-22", fetchImpl,
    });
    const h = sales.perApp[0];
    expect(h.units.thisWeek).toBe(6);
    expect(h.units.lastWeek).toBe(4);
    expect(h.units.deltaPct).toBeCloseTo(0.5);
    expect(sales.window).toEqual({ thisWeek: "2026-06-29", lastWeek: "2026-06-22" });
  });
});
