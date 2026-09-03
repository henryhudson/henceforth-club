import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateLink } from "@/app/folklore/linkRecord";
import { MAP_PREFIX } from "@/app/folklore/mapPost";

const mockFetchTxScripts = vi.fn();

vi.mock("@/lib/whatsonchain", () => ({
  fetchTxScripts: (...args: unknown[]) => mockFetchTxScripts(...args),
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
  mockFetchTxScripts.mockReset();
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
    });
  });

  it("keeps an opaque transaction listable, with no title to offer", async () => {
    mockFetchTxScripts.mockResolvedValue([script(["not-a-protocol"])]);
    expect(await (await GET(request(`?txid=${TXID}`))).json()).toEqual({
      ok: true,
      txid: TXID,
      kind: "opaque",
    });
  });

  it("points a stamp at the target it should list instead", async () => {
    mockFetchTxScripts.mockResolvedValue([jsonScript(validateLink(OTHER, "listed"))]);
    expect(await (await GET(request(`?txid=${TXID}`))).json()).toEqual({
      ok: true,
      txid: TXID,
      kind: "stamp",
      listInstead: OTHER,
    });
  });

  it("lowercases the id before reading it", async () => {
    mockFetchTxScripts.mockResolvedValue([script(["not-a-protocol"])]);
    const body = await (await GET(request(`?txid=${TXID.toUpperCase()}`))).json();
    expect(mockFetchTxScripts).toHaveBeenCalledWith(TXID);
    expect(body.txid).toBe(TXID);
  });
});
