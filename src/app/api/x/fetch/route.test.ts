import { beforeEach, describe, expect, it, vi } from "vitest";

// The shared-token fetch: every call spends the operator's money at X, so the
// payment gate must run before any X call. Unlike the archive route, this one
// has no check of its own — it relies wholly on `payAndReserve` — so the REAL
// gate runs here, with fakes only at its boundaries: the price feed, the chain
// read, the Redis reservation and burn, and X itself. The order of `calls` is
// the contract.
const state = {
  calls: [] as string[],
  head: null as { postCount: number } | null,
  archive: { posts: [] as unknown[] },
  verdict: { ok: true, sats: 1_000 } as { ok: true; sats: number } | { ok: false; reason: "not-found" | "underpaid" },
};

vi.mock("@/lib/xfetch", () => ({
  fetchProfileHead: async () => {
    state.calls.push("x-head");
    return state.head;
  },
  fetchXArchive: async () => {
    state.calls.push("x-archive");
    return { archive: state.archive, mediaRefs: [{ postId: "leaked-if-seen" }] };
  },
}));
vi.mock("@/lib/xPrice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/xPrice")>()),
  bsvUsd: async () => {
    state.calls.push("price");
    return { ok: true, bsvUsd: 50 };
  },
}));
vi.mock("@/lib/xPayment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/xPayment")>()),
  verifyPayment: async () => {
    state.calls.push("verify");
    return state.verdict;
  },
  consumePayment: async () => {
    state.calls.push("burn");
    return { ok: true };
  },
}));
vi.mock("@/lib/xSpend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/xSpend")>()),
  reserveXApiSpend: async (resources: number) => {
    state.calls.push(`reserve:${resources}`);
    return { ok: true, reservedUsd: 0.505 };
  },
  releaseXApiSpend: async (resources: number) => {
    state.calls.push(`release:${resources}`);
  },
}));

import { GET } from "./route";

const get = (query: string) => GET(new Request(`http://x/api/x/fetch?${query}`));
const PAID = "payment=" + "a".repeat(64);

beforeEach(() => {
  process.env.X_BEARER_TOKEN = "test-token";
  state.calls.length = 0;
  state.head = { postCount: 40 };
  state.archive = { posts: [{ id: "1" }] };
  state.verdict = { ok: true, sats: 1_000 };
});

describe("GET /api/x/fetch — the payment gate stands before X", () => {
  it("refuses an unpaid call 402 payment-required before reading anything: no price, no chain, no X", async () => {
    const res = await get("handle=henryhudson6");
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, reason: "payment-required" });
    expect(state.calls).toEqual([]);
  });

  it("a malformed payment id is unpaid too", async () => {
    const res = await get("handle=henryhudson6&payment=not-a-txid");
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, reason: "payment-required" });
    expect(state.calls).toEqual([]);
  });

  it("a payment that does not cover the read never reaches X", async () => {
    state.verdict = { ok: false, reason: "underpaid" };
    const res = await get(`handle=henryhudson6&${PAID}`);
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, reason: "underpaid" });
    expect(state.calls).toEqual(["price", "verify"]);
  });

  it("a verified payment buys one head and one page, in the gate's order, and the archive comes back unwrapped", async () => {
    const res = await get(`handle=@henryhudson6&${PAID}`);
    expect(res.status).toBe(200);
    // The app decodes the SocialArchive as-is: the envelope's media refs must not leak.
    expect(await res.json()).toEqual({ posts: [{ id: "1" }] });
    // Free checks, then the chain, then the budget, then the burn — and only then X.
    // 101 is RESOURCES_TEXT_ONLY: one user object plus one page of posts.
    expect(state.calls).toEqual(["price", "verify", "reserve:101", "burn", "x-head", "x-archive"]);
  });

  it("answers 404 no-user when X has no such profile, after the gate has run", async () => {
    state.head = null;
    const res = await get(`handle=henryhudson6&${PAID}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "no-user" });
    expect(state.calls).not.toContain("x-archive");
  });

  it("a bad handle is refused before the gate", async () => {
    const res = await get(`handle=not+a+handle&${PAID}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-handle" });
    expect(state.calls).toEqual([]);
  });

  it("fails closed without the server token, touching nothing", async () => {
    delete process.env.X_BEARER_TOKEN;
    const res = await get(`handle=henryhudson6&${PAID}`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "server-token-unset" });
    expect(state.calls).toEqual([]);
  });
});
