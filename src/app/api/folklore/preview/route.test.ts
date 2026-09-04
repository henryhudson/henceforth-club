import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateLink } from "@/app/folklore/linkRecord";
import { MAP_PREFIX } from "@/app/folklore/mapPost";
import { READS_PER_ADDRESS } from "@/lib/folkloreJob/submitThrottle";

const mockFetchTxScripts = vi.fn();
const mockIsBoardLink = vi.fn();

vi.mock("@/lib/whatsonchain", () => ({
  fetchTxScripts: (...args: unknown[]) => mockFetchTxScripts(...args),
}));
vi.mock("@/lib/folkloreBoard", () => ({
  isBoardLink: (...args: unknown[]) => mockIsBoardLink(...args),
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

import { GET } from "./route";

const TXID = "ab".repeat(32);
const OTHER = "cd".repeat(32);

function push(s: string): string {
  const bytes = new TextEncoder().encode(s);
  return `${bytes.length.toString(16).padStart(2, "0")}${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function script(parts: string[]): string {
  return "6a" + parts.map(push).join("");
}
function jsonScript(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const header = [0x4d, bytes.length & 0xff, (bytes.length >> 8) & 0xff];
  return "6a" + [...header, ...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const request = (query: string) => new Request(`http://x/api/folklore/preview${query}`);

beforeEach(() => {
  throttleCounters.clear();
  mockFetchTxScripts.mockReset();
  mockIsBoardLink.mockReset();
  mockIsBoardLink.mockResolvedValue(false);
});

describe("GET /api/folklore/preview", () => {
  it("requires a 64-hex id and never touches the chain without one", async () => {
    for (const query of ["", "?txid=", "?txid=abc", `?txid=${"g".repeat(64)}`, `?txid=https://x/${TXID}`]) {
      const res = await GET(request(query));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, reason: "bad-input" });
    }
    expect(mockFetchTxScripts).not.toHaveBeenCalled();
  });

  it("answers unknown-tx, not an error, for an id the chain cannot serve", async () => {
    mockFetchTxScripts.mockResolvedValue(null);
    const res = await GET(request(`?txid=${TXID}`));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "unknown-tx" });
  });

  it("carries the classification: a Magic Attribute Protocol post with its source and default title", async () => {
    mockFetchTxScripts.mockResolvedValue([
      script([MAP_PREFIX, "SET", "app", "twetch", "type", "post", "text", "A cello note\nmore"]),
    ]);
    const res = await GET(request(`?txid=${TXID}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      txid: TXID,
      kind: "map",
      source: "twetch",
      title: "A cello note",
      listed: false,
    });
  });

  it("keeps an opaque transaction listable, with no title to offer", async () => {
    mockFetchTxScripts.mockResolvedValue([script(["not-a-protocol"])]);
    expect(await (await GET(request(`?txid=${TXID}`))).json()).toEqual({
      ok: true,
      txid: TXID,
      kind: "opaque",
      listed: false,
    });
  });

  it("points a stamp at the target it should list instead", async () => {
    mockFetchTxScripts.mockResolvedValue([jsonScript(validateLink(OTHER, "listed"))]);
    expect(await (await GET(request(`?txid=${TXID}`))).json()).toEqual({
      ok: true,
      txid: TXID,
      kind: "stamp",
      listInstead: OTHER,
      listed: false,
    });
  });

  it("says when the board already lists the id, from one board read of that id", async () => {
    // The refusal before the money: a visitor who pastes a listed target must
    // learn it here, not from the index's 409 after the ten pence is on chain.
    mockFetchTxScripts.mockResolvedValue([script(["not-a-protocol"])]);
    mockIsBoardLink.mockResolvedValue(true);
    const body = await (await GET(request(`?txid=${TXID}`))).json();
    expect(body).toEqual({ ok: true, txid: TXID, kind: "opaque", listed: true });
    expect(mockIsBoardLink).toHaveBeenCalledTimes(1);
    expect(mockIsBoardLink).toHaveBeenCalledWith(TXID);
  });

  it("lowercases the id before reading it", async () => {
    mockFetchTxScripts.mockResolvedValue([script(["not-a-protocol"])]);
    const body = await (await GET(request(`?txid=${TXID.toUpperCase()}`))).json();
    expect(mockFetchTxScripts).toHaveBeenCalledWith(TXID);
    expect(body.txid).toBe(TXID);
  });
});

describe("GET /api/folklore/preview — the read allowance", () => {
  const from = (address: string, txid = TXID) =>
    new Request(`http://x/api/folklore/preview?txid=${txid}`, {
      headers: { "x-forwarded-for": address },
    });

  it("refuses a read past the allowance before the chain is asked, and says when to come back", async () => {
    // Every distinct unknown id costs the site two upstream calls on its
    // anonymous quota (a miss is never cached), so a flood of random ids from
    // one address turns honest stamps into unknown-tx. The allowance stops
    // it at the door; the next visitor is untouched.
    mockFetchTxScripts.mockResolvedValue([script(["not-a-protocol"])]);
    for (let i = 0; i < READS_PER_ADDRESS; i += 1) {
      expect((await GET(from("10.0.0.1"))).status).toBe(200);
    }
    mockFetchTxScripts.mockClear();

    const res = await GET(from("10.0.0.1"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, reason: "too-many-submissions" });
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mockFetchTxScripts).not.toHaveBeenCalled();

    expect((await GET(from("198.51.100.9"))).status).toBe(200);
  });

  it("spends no allowance on a malformed id", async () => {
    for (let i = 0; i < READS_PER_ADDRESS + 5; i += 1) {
      expect((await GET(from("10.0.0.3", "abc"))).status).toBe(400);
    }
    mockFetchTxScripts.mockResolvedValue([script(["not-a-protocol"])]);
    expect((await GET(from("10.0.0.3"))).status).toBe(200);
  });
});
