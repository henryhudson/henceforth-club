import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeRecord, validateComment, validateLink } from "@/app/folklore/linkRecord";
import { quoteLink } from "@/lib/folkloreJob/linkQuote";
import { READS_PER_ADDRESS } from "@/lib/folkloreJob/submitThrottle";
import { REVENUE_ADDRESS } from "@/lib/revenueAddress";

const mockIndexSince = vi.fn();
const mockAddLinkToBoard = vi.fn();
const mockIsBoardLink = vi.fn();
const mockFetchTxScripts = vi.fn();
const mockFetchTxOutputs = vi.fn();
const mockGbpPerBsv = vi.fn();

vi.mock("@/lib/folkloreBoard", () => ({
  indexSince: (...args: unknown[]) => mockIndexSince(...args),
  addLinkToBoard: (...args: unknown[]) => mockAddLinkToBoard(...args),
  isBoardLink: (...args: unknown[]) => mockIsBoardLink(...args),
}));
// The chain reads are faked; the record parser, the floor quote and the
// revenue sum are the real ones, so the money property is asserted against
// the code that will run rather than a stub of it.
vi.mock("@/lib/whatsonchain", () => ({
  fetchTxScripts: (...args: unknown[]) => mockFetchTxScripts(...args),
  fetchTxOutputs: (...args: unknown[]) => mockFetchTxOutputs(...args),
}));
vi.mock("@/lib/xPrice", () => ({
  gbpPerBsv: (...args: unknown[]) => mockGbpPerBsv(...args),
}));
// The read allowance is NOT mocked — the real throttle runs against an
// in-memory counter, the link route's own arrangement, so the property is
// asserted at the route rather than against a stub of itself.
const throttleCounters = new Map<string, number>();
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({
    incr: async (key: string) => {
      const next = (throttleCounters.get(key) ?? 0) + 1;
      throttleCounters.set(key, next);
      return next;
    },
    expire: async () => 1,
    get: async (key: string) => throttleCounters.get(key) ?? null,
  }),
}));

import { GET, POST, dynamic } from "./route";

const TXID_A = "a".repeat(64);
const TXID_B = "b".repeat(64);

const request = (query = "") =>
  new Request(`http://x/api/folklore/index${query}`);

beforeEach(() => {
  throttleCounters.clear();
  mockIndexSince.mockReset();
  mockIndexSince.mockResolvedValue({ txids: [TXID_A, TXID_B], now: 1_753_000_000_000 });
});

describe("GET /api/folklore/index", () => {
  it("defaults since to 0 — the first sync returns everything", async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ txids: [TXID_A, TXID_B], now: 1_753_000_000_000 });
    expect(mockIndexSince).toHaveBeenCalledWith(0);
  });

  it("passes an honest since through in milliseconds", async () => {
    const res = await GET(request("?since=1752900000000"));
    expect(res.status).toBe(200);
    expect(mockIndexSince).toHaveBeenCalledWith(1_752_900_000_000);
  });

  it("treats garbage since as 0 — never a 500", async () => {
    for (const bad of ["?since=garbage", "?since=", "?since=NaN", "?since=Infinity"]) {
      const res = await GET(request(bad));
      expect(res.status).toBe(200);
      expect(mockIndexSince).toHaveBeenLastCalledWith(0);
    }
  });

  it("clamps a negative since to 0", async () => {
    const res = await GET(request("?since=-5000"));
    expect(res.status).toBe(200);
    expect(mockIndexSince).toHaveBeenCalledWith(0);
  });

  it("carries the server's now — the client's next watermark", async () => {
    mockIndexSince.mockResolvedValue({ txids: [], now: 41_000 });
    const body = await (await GET(request("?since=99999"))).json();
    expect(body).toEqual({ txids: [], now: 41_000 });
  });

  it("is never cached: Cache-Control no-store, force-dynamic", async () => {
    const res = await GET(request());
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(dynamic).toBe("force-dynamic");
  });
});

// ---------------------------------------------------------------------------
// POST — the cheap path's index

const TARGET = "ab".repeat(32);
const STAMP = "cd".repeat(32);
const RATE = 10.76375;

/** An OP_RETURN script carrying one JSON pushdata — the stamp's record. */
function jsonScript(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const header = [0x4d, bytes.length & 0xff, (bytes.length >> 8) & 0xff];
  return "6a" + [...header, ...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const STAMP_RECORD = validateLink(TARGET, "A cello note", "henry");
if (!STAMP_RECORD) throw new Error("fixture stamp must validate");
const quotedFloor = quoteLink(encodeRecord(STAMP_RECORD).length, RATE);
if (!quotedFloor) throw new Error("fixture floor must quote");
const FLOOR = quotedFloor.premiumSats;

/** The stamp's outputs: a payment of `sats` to the revenue address beside
 * the data output. */
const paid = (sats: number) => [
  { value: sats / 100_000_000, addresses: [REVENUE_ADDRESS] },
  { value: 0, addresses: [] },
];

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/api/folklore/index", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/folklore/index", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "true");
    for (const mock of [
      mockAddLinkToBoard,
      mockIsBoardLink,
      mockFetchTxScripts,
      mockFetchTxOutputs,
      mockGbpPerBsv,
    ]) {
      mock.mockReset();
    }
    mockFetchTxScripts.mockResolvedValue([jsonScript(STAMP_RECORD)]);
    mockFetchTxOutputs.mockResolvedValue(paid(FLOOR));
    mockGbpPerBsv.mockResolvedValue(RATE);
    mockIsBoardLink.mockResolvedValue(false);
    mockAddLinkToBoard.mockResolvedValue("listed");
  });

  it("refuses 503 not-available while the flag is dark, before any read", async () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", undefined);
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(mockFetchTxScripts).not.toHaveBeenCalled();
    expect(mockAddLinkToBoard).not.toHaveBeenCalled();
  });

  it("still refuses for any value other than the exact string true", async () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "1");
    expect((await POST(post({ stampTxid: STAMP }))).status).toBe(503);
  });

  it("refuses bad input without touching the chain: not JSON, no id, a short id", async () => {
    for (const body of ["{not json", {}, { stampTxid: "abc" }, { stampTxid: 42 }, "null"]) {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
      expect((await res.json()).reason).toBe("bad-input");
    }
    expect(mockFetchTxScripts).not.toHaveBeenCalled();
  });

  it("refuses an oversized envelope before reading it", async () => {
    const res = await POST(post({ stampTxid: STAMP }, { "content-length": String(64 * 1024) }));
    expect(res.status).toBe(413);
    expect((await res.json()).reason).toBe("too-large");
  });

  it("lists a valid stamp: the target lands on the board and the reply names it", async () => {
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, target: TARGET, stampTxid: STAMP });
    expect(mockAddLinkToBoard).toHaveBeenCalledTimes(1);
    const [stamp, record, nowMs] = mockAddLinkToBoard.mock.calls[0];
    expect(stamp).toBe(STAMP);
    expect(record).toEqual(STAMP_RECORD);
    expect(typeof nowMs).toBe("number");
  });

  it("lowercases the stamp id it is given", async () => {
    const res = await POST(post({ stampTxid: STAMP.toUpperCase() }));
    expect(res.status).toBe(200);
    expect(mockFetchTxScripts).toHaveBeenCalledWith(STAMP);
    expect((await res.json()).stampTxid).toBe(STAMP);
  });

  it("refuses unknown-tx when the stamp cannot be read from the chain", async () => {
    mockFetchTxScripts.mockResolvedValue(null);
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("unknown-tx");
    expect(mockAddLinkToBoard).not.toHaveBeenCalled();
  });

  it("refuses unknown-tx when the stamp's outputs cannot be read", async () => {
    mockFetchTxOutputs.mockResolvedValue(null);
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("unknown-tx");
    expect(mockAddLinkToBoard).not.toHaveBeenCalled();
  });

  it("refuses bad-record when the stamp carries no folklore link", async () => {
    const comment = validateComment(TARGET, "not a stamp");
    for (const scripts of [["6a0c6e6f742d612d70726f746f636f6c"], [jsonScript(comment)]]) {
      mockFetchTxScripts.mockResolvedValue(scripts);
      const res = await POST(post({ stampTxid: STAMP }));
      expect(res.status).toBe(400);
      expect((await res.json()).reason).toBe("bad-record");
    }
    expect(mockAddLinkToBoard).not.toHaveBeenCalled();
  });

  it("refuses not-a-target for a legacy https-only record", async () => {
    mockFetchTxScripts.mockResolvedValue([
      jsonScript(validateLink("https://example.com/a", "Legacy")),
    ]);
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("not-a-target");
    expect(mockAddLinkToBoard).not.toHaveBeenCalled();
  });

  it("refuses already-listed before reading any payment when the target is on the board", async () => {
    mockIsBoardLink.mockResolvedValue(true);
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "already-listed", target: TARGET });
    expect(mockFetchTxOutputs).not.toHaveBeenCalled();
    expect(mockGbpPerBsv).not.toHaveBeenCalled();
    expect(mockAddLinkToBoard).not.toHaveBeenCalled();
  });

  it("refuses already-listed when a second stamp loses the nx write", async () => {
    mockAddLinkToBoard.mockResolvedValue("already-listed");
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "already-listed", target: TARGET });
  });

  it("refuses floor-short by one satoshi, naming what was paid and what the floor is", async () => {
    mockFetchTxOutputs.mockResolvedValue(paid(FLOOR - 1));
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "floor-short",
      revenueSats: FLOOR - 1,
      floorSats: FLOOR,
    });
    expect(mockAddLinkToBoard).not.toHaveBeenCalled();
  });

  it("counts every output to the revenue address towards the floor", async () => {
    mockFetchTxOutputs.mockResolvedValue([
      { value: 0, addresses: [] },
      { value: (FLOOR - 1_000) / 100_000_000, addresses: [REVENUE_ADDRESS] },
      { value: 1_000 / 100_000_000, addresses: [REVENUE_ADDRESS] },
    ]);
    expect((await POST(post({ stampTxid: STAMP }))).status).toBe(200);
  });

  it("refuses floor-short when nothing pays the revenue address at all", async () => {
    mockFetchTxOutputs.mockResolvedValue([
      { value: 1, addresses: ["1BitcoinEaterAddressDontSendf59kuE"] },
    ]);
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(402);
    expect((await res.json()).revenueSats).toBe(0);
  });

  it("refuses price-unavailable, never a guessed floor, when there is no live rate", async () => {
    mockGbpPerBsv.mockResolvedValue(undefined);
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe("price-unavailable");
    expect(mockAddLinkToBoard).not.toHaveBeenCalled();
  });

  it("relays store-unavailable when the board cannot be written — the stamp stands", async () => {
    mockAddLinkToBoard.mockResolvedValue("unavailable");
    const res = await POST(post({ stampTxid: STAMP }));
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe("store-unavailable");
  });

  describe("the read allowance", () => {
    const from = (address: string, body: unknown = { stampTxid: STAMP }) =>
      post(body, { "x-forwarded-for": address });

    it("refuses past the allowance before the chain is asked, and says when to come back", async () => {
      // Two chain reads and a rate read per call, all on the site's anonymous
      // quota: the same flood the preview's allowance stops, at the second
      // door it could come through.
      for (let i = 0; i < READS_PER_ADDRESS; i += 1) {
        expect((await POST(from("10.0.0.1"))).status).toBe(200);
      }
      mockFetchTxScripts.mockClear();

      const res = await POST(from("10.0.0.1"));
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ ok: false, reason: "too-many-submissions" });
      expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
      expect(mockFetchTxScripts).not.toHaveBeenCalled();
      expect(mockAddLinkToBoard).toHaveBeenCalledTimes(READS_PER_ADDRESS);

      expect((await POST(from("198.51.100.9"))).status).toBe(200);
    });

    it("spends no allowance on bad input", async () => {
      for (let i = 0; i < READS_PER_ADDRESS + 5; i += 1) {
        expect((await POST(from("10.0.0.3", { stampTxid: "abc" }))).status).toBe(400);
      }
      expect((await POST(from("10.0.0.3"))).status).toBe(200);
    });
  });
});
