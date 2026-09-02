import { describe, it, expect, vi } from "vitest";
import { broadcastRaw, txidFromBroadcast, BROADCAST_ENDPOINTS } from "./chain-put.mjs";

const TXID = "a".repeat(64);
const ok = () => ({ ok: true, status: 200, text: async () => `"${TXID}"` });
const limited = () => ({ ok: false, status: 429, text: async () => "<h1>429 Too Many Requests</h1>" });
const rejected = () => ({ ok: false, status: 400, text: async () => "16: mandatory-script-verify-flag-failed" });

describe("broadcastRaw", () => {
  it("returns the transaction id, lower-cased and unquoted", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => `"${TXID.toUpperCase()}"` }));
    expect(await broadcastRaw("00", { fetchImpl, log: () => {} })).toBe(TXID);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("waits out a rate limit and sends the next attempt to the other processor", async () => {
    const hosts = [];
    const fetchImpl = vi.fn(async (url) => {
      hosts.push(new URL(url).host);
      return hosts.length === 1 ? limited() : ok();
    });
    const slept = [];
    const txid = await broadcastRaw("00", { fetchImpl, sleep: async (ms) => { slept.push(ms); }, log: () => {} });
    expect(txid).toBe(TXID);
    expect(hosts).toEqual([new URL(BROADCAST_ENDPOINTS[0]).host, new URL(BROADCAST_ENDPOINTS[1]).host]);
    expect(slept).toEqual([500]);
  });

  it("gives up after the last backoff, carrying the processor's own words", async () => {
    const fetchImpl = vi.fn(async () => limited());
    await expect(broadcastRaw("00", { fetchImpl, sleep: async () => {}, log: () => {} }))
      .rejects.toThrow(/broadcast failed: .*429/s);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("does not retry a rejected transaction — a second processor would reject it too", async () => {
    const fetchImpl = vi.fn(async () => rejected());
    await expect(broadcastRaw("00", { fetchImpl, sleep: async () => {}, log: () => {} }))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("txidFromBroadcast", () => {
  const id = "77176969c2d9f295a92218edc87b9e9232b711542568c6e6ae25e49cdbaa38b7";

  it("reads WhatsOnChain's bare id, quoted or not, in either case", () => {
    expect(txidFromBroadcast(id)).toBe(id);
    expect(txidFromBroadcast(`"${id.toUpperCase()}"\n`)).toBe(id);
  });

  it("reads the mirror's status object, which an id-only reader threw away", () => {
    const body = JSON.stringify({ status: 200, title: "OK", txid: id, txStatus: "SEEN_ON_NETWORK" });
    expect(txidFromBroadcast(body)).toBe(id);
  });

  it("refuses a status object that names a transaction but reports a rejection", () => {
    expect(txidFromBroadcast(JSON.stringify({ txid: id, txStatus: "REJECTED" }))).toBe(null);
  });

  it("returns null for an error page or anything else without an id", () => {
    expect(txidFromBroadcast("<h1>429 Too Many Requests</h1>")).toBe(null);
    expect(txidFromBroadcast("16: mandatory-script-verify-flag-failed")).toBe(null);
  });
});

describe("broadcastRaw over the mirror", () => {
  const id = "b".repeat(64);
  it("accepts the mirror's status object after a rate limit", async () => {
    let n = 0;
    const fetchImpl = async () => {
      n += 1;
      return n === 1
        ? { ok: false, status: 429, text: async () => "429 Too Many Requests" }
        : { ok: true, status: 200, text: async () => JSON.stringify({ status: 200, txid: id, txStatus: "SEEN_ON_NETWORK" }) };
    };
    expect(await broadcastRaw("00", { fetchImpl, sleep: async () => {}, log: () => {} })).toBe(id);
  });
});
