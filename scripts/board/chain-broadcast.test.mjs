import { describe, it, expect, vi } from "vitest";
import { broadcastRaw, fetchIndexer, txidFromBroadcast, BROADCAST_BACKOFF_MS, BROADCAST_ENDPOINTS } from "./chain-put.mjs";

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

describe("fetchIndexer", () => {
  const quiet = { sleep: async () => {}, log: () => {} };

  it("returns the body of a plain answer at once", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{"result":[]}' }));
    expect(await fetchIndexer("/address/1x/unspent/all", { fetchImpl, ...quiet })).toBe('{"result":[]}');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("treats a challenge page dressed as a 200 as no answer, and tries the other indexer", async () => {
    const hosts = [];
    const fetchImpl = vi.fn(async (url) => {
      hosts.push(new URL(url).host);
      return hosts.length === 1
        ? { ok: true, status: 200, text: async () => "<!DOCTYPE html><html><title>Just a moment...</title></html>" }
        : { ok: true, status: 200, text: async () => "0100000001abcd" };
    });
    expect(await fetchIndexer("/tx/ab/hex", { fetchImpl, ...quiet })).toBe("0100000001abcd");
    expect(hosts).toEqual([new URL(BROADCAST_ENDPOINTS[0]).host, new URL(BROADCAST_ENDPOINTS[1]).host]);
  });

  it("keeps trying past a mirror that lacks the endpoint, back to the first indexer", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) return { ok: false, status: 429, text: async () => "429 Too Many Requests" };
      if (n === 2) return { ok: false, status: 404, text: async () => "not found" };
      return { ok: true, status: 200, text: async () => '{"result":[{"tx_hash":"a","tx_pos":0,"value":1}]}' };
    });
    expect(await fetchIndexer("/address/1x/unspent/all", { fetchImpl, ...quiet })).toContain("tx_hash");
    expect(n).toBe(3);
  });

  it("gives up after the last backoff, carrying the status and the body", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, text: async () => "<h1>429 Too Many Requests</h1>" }));
    await expect(fetchIndexer("/tx/ab/hex", { fetchImpl, ...quiet })).rejects.toThrow(/indexer read failed .*429/s);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });
});

// The four defects of the first real publish (2 September 2026) were each found
// by running it with money. The pacing and the failover below are what a
// per-minute window and a challenge page taught it; pinned here so the next
// change to either is caught by the suite and not by a run.
describe("broadcastRaw pacing", () => {
  const woc = new URL(BROADCAST_ENDPOINTS[0]).host;
  const mirror = new URL(BROADCAST_ENDPOINTS[1]).host;

  it("spreads six attempts over BROADCAST_BACKOFF_MS in order, alternating processors on every one", async () => {
    const hosts = [];
    const slept = [];
    const fetchImpl = vi.fn(async (url) => {
      hosts.push(new URL(url).host);
      return limited();
    });
    await expect(broadcastRaw("00", { fetchImpl, sleep: async (ms) => { slept.push(ms); }, log: () => {} }))
      .rejects.toThrow(/broadcast failed/);
    expect(hosts).toEqual([woc, mirror, woc, mirror, woc, mirror]);
    expect(slept).toEqual(BROADCAST_BACKOFF_MS);
    // The schedule itself: about half a minute, enough to outlast a per-minute window.
    expect(BROADCAST_BACKOFF_MS).toEqual([500, 2_000, 5_000, 10_000, 15_000]);
  });

  it("posts the same signed hex to /tx/raw on each processor", async () => {
    const requests = [];
    const fetchImpl = vi.fn(async (url, init) => {
      requests.push({ url, method: init.method, body: JSON.parse(init.body) });
      return requests.length === 1 ? limited() : ok();
    });
    await broadcastRaw("00abcd", { fetchImpl, sleep: async () => {}, log: () => {} });
    expect(requests).toEqual([
      { url: `${BROADCAST_ENDPOINTS[0]}/tx/raw`, method: "POST", body: { txhex: "00abcd" } },
      { url: `${BROADCAST_ENDPOINTS[1]}/tx/raw`, method: "POST", body: { txhex: "00abcd" } },
    ]);
  });

  it("stops at a rejection that follows a rate limit — a second processor would reject it too", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => (++n === 1 ? limited() : rejected()));
    const slept = [];
    await expect(broadcastRaw("00", { fetchImpl, sleep: async (ms) => { slept.push(ms); }, log: () => {} }))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(slept).toEqual([500]);
  });

  it("reads a rate limit from the body when the status is not 429", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => (++n === 1
      ? { ok: false, status: 503, text: async () => "Too Many Requests" }
      : ok()));
    expect(await broadcastRaw("00", { fetchImpl, sleep: async () => {}, log: () => {} })).toBe(TXID);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("fetchIndexer pacing and failover", () => {
  const woc = new URL(BROADCAST_ENDPOINTS[0]).host;
  const mirror = new URL(BROADCAST_ENDPOINTS[1]).host;

  it("spreads six reads over BROADCAST_BACKOFF_MS in order, alternating indexers, when every answer is a page", async () => {
    const urls = [];
    const slept = [];
    const fetchImpl = vi.fn(async (url) => {
      urls.push(url);
      return { ok: true, status: 200, text: async () => "<html><body>Attention Required! | Cloudflare</body></html>" };
    });
    await expect(fetchIndexer("/tx/ab/hex", { fetchImpl, sleep: async (ms) => { slept.push(ms); }, log: () => {} }))
      .rejects.toThrow(/indexer read failed for \/tx\/ab\/hex: 200: <html>/);
    expect(urls.map((u) => new URL(u).host)).toEqual([woc, mirror, woc, mirror, woc, mirror]);
    expect(urls[0]).toBe(`${BROADCAST_ENDPOINTS[0]}/tx/ab/hex`);
    expect(urls[1]).toBe(`${BROADCAST_ENDPOINTS[1]}/tx/ab/hex`);
    expect(slept).toEqual(BROADCAST_BACKOFF_MS);
  });

  it("retries a server error on the other indexer — a read is idempotent", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => (++n === 1
      ? { ok: false, status: 500, text: async () => "internal error" }
      : { ok: true, status: 200, text: async () => "0100000001abcd" }));
    expect(await fetchIndexer("/tx/ab/hex", { fetchImpl, sleep: async () => {}, log: () => {} })).toBe("0100000001abcd");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
