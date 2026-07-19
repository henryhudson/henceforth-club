import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIndexSince = vi.fn();

vi.mock("@/lib/folkloreBoard", () => ({
  indexSince: (...args: unknown[]) => mockIndexSince(...args),
}));

import { GET, dynamic } from "./route";

const TXID_A = "a".repeat(64);
const TXID_B = "b".repeat(64);

const request = (query = "") =>
  new Request(`http://x/api/folklore/index${query}`);

beforeEach(() => {
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
