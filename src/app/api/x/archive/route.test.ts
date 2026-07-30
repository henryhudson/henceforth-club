import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory fakes for the input/output boundaries, register-route pattern.
const state = {
  head: null as { postCount: number } | null,
  fetchResult: null as { archive: { posts: unknown[] }; mediaRefs: unknown[] } | null,
  gateOk: true,
  gatedResources: [] as number[],
  released: [] as number[],
  /** The unpaid head ceiling: what the route reserved and handed back. */
  headReserve: null as null | { ok: false; reason: "budget-exhausted" | "accounting-unavailable" },
  headReserved: 0,
  headReleased: 0,
  /** The ORDER of the billed side effects, because the order is the contract. */
  calls: [] as string[],
};

vi.mock("@/lib/xfetch", () => ({
  fetchProfileHead: async () => {
    state.calls.push("head-read");
    return state.head;
  },
  fetchXArchive: async () => state.fetchResult,
  pagesForPostCount: (n: number) => Math.max(1, Math.ceil(n / 100)),
  X_TIMELINE_CEILING: 3200,
}));
vi.mock("@/lib/xGate", () => ({
  payAndReserve: async (_payment: string | null, resources: number) => {
    state.gatedResources.push(resources);
    return state.gateOk
      ? { ok: true, sats: 1, reservedUsd: 1 }
      : { ok: false, response: new Response(null, { status: 402 }) };
  },
  // The same shape the real one has (posts + the user object); the tests only
  // need the ROUTE to release exactly what it reserved.
  resourcesForPosts: (posts: number) => posts + 1,
}));
vi.mock("@/lib/xArchive", () => ({ selectRefs: (refs: unknown[]) => refs }));
vi.mock("@/lib/xSpend", () => ({
  releaseXApiSpend: async (n: number) => {
    state.released.push(n);
  },
}));
vi.mock("@/lib/xHeadSpend", () => ({
  reserveHeadRead: async () => {
    state.calls.push("head-reserve");
    if (state.headReserve) return state.headReserve;
    state.headReserved += 1;
    return { ok: true, reservedUsd: 0.005 };
  },
  releaseHeadRead: async () => {
    state.calls.push("head-release");
    state.headReleased += 1;
  },
}));

import { GET } from "./route";

const get = (query: string) => GET(new Request(`http://x/api/x/archive?${query}`));
const PAID = "payment=" + "a".repeat(64);

beforeEach(() => {
  process.env.X_BEARER_TOKEN = "test-token";
  state.head = { postCount: 500 };
  state.fetchResult = null;
  state.gateOk = true;
  state.gatedResources.length = 0;
  state.released.length = 0;
  state.headReserve = null;
  state.headReserved = 0;
  state.headReleased = 0;
  state.calls.length = 0;
});

describe("GET /api/x/archive — budget settlement", () => {
  it("hands the reservation back when the read fails AFTER the gate (the post-burn no-user arm)", async () => {
    state.fetchResult = null; // X refused the timeline after a successful head
    const res = await get(`handle=henryhudson6&${PAID}&full=1`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "no-user" });
    // The reservation the gate took (posts + 1 = 501) is released in full —
    // the day's budget must not shrink for a read that never happened.
    expect(state.gatedResources).toEqual([501]);
    expect(state.released).toEqual([501]);
    // The head reservation is NOT handed back here: that head really was read
    // and really was billed, whatever the timeline did afterwards.
    expect(state.headReserved).toBe(1);
    expect(state.headReleased).toBe(0);
  });

  it("keeps the reservation when the read is served — that budget was really spent", async () => {
    state.fetchResult = { archive: { posts: [{ id: "1" }] }, mediaRefs: [] };
    const res = await get(`handle=henryhudson6&${PAID}&full=1`);
    expect(res.status).toBe(200);
    expect(state.released).toEqual([]);
    expect(state.headReleased).toBe(0);
  });

  it("releases the HEAD reservation on the pre-gate no-user arm, and reserves nothing from the paid budget", async () => {
    // This arm's meaning changed when the head read stopped being unaccounted.
    // Before: nothing was reserved, so nothing was released. Now the head IS
    // booked before the read — and because X bills per resource RETURNED and
    // returned none, it must be handed straight back. Without that, `?handle=
    // zzzz1&full=1` would be a free way to pin the day's ceiling, since the
    // handle pattern admits any short alphanumeric string.
    state.head = null;
    const res = await get(`handle=nosuchuser&${PAID}&full=1`);
    expect(res.status).toBe(404);
    expect(state.gatedResources).toEqual([]); // the paid gate is never reached
    expect(state.released).toEqual([]);
    expect(state.headReserved).toBe(1);
    expect(state.headReleased).toBe(1);
  });

  it("releases nothing when the gate itself refuses — payAndReserve settles its own arms", async () => {
    state.gateOk = false;
    const res = await get(`handle=henryhudson6&${PAID}&full=1`);
    expect(res.status).toBe(402);
    expect(state.released).toEqual([]);
    // The head was read before the gate refused, so its half-cent stands.
    expect(state.headReleased).toBe(0);
  });
});

describe("GET /api/x/archive — the unpaid head ceiling", () => {
  it("BOOKS THE HEAD BEFORE READING IT — the order is the whole protection", async () => {
    state.fetchResult = { archive: { posts: [] }, mediaRefs: [] };
    await get(`handle=henryhudson6&${PAID}&full=1`);
    expect(state.calls.slice(0, 2)).toEqual(["head-reserve", "head-read"]);
  });

  it("an exhausted head budget refuses 429 WITHOUT touching X", async () => {
    state.headReserve = { ok: false, reason: "budget-exhausted" };
    const res = await get(`handle=henryhudson6&${PAID}&full=1`);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, reason: "budget-exhausted" });
    // The point of a ceiling is that the money is not spent. Assert the billed
    // call never happened, rather than only that the status is right.
    expect(state.calls).not.toContain("head-read");
    expect(state.gatedResources).toEqual([]);
  });

  it("refuses 503 when the spend cannot be accounted for — fails CLOSED", async () => {
    state.headReserve = { ok: false, reason: "accounting-unavailable" };
    const res = await get(`handle=henryhudson6&${PAID}&full=1`);
    expect(res.status).toBe(503);
    expect(state.calls).not.toContain("head-read");
  });

  it("does not touch the head ceiling at all without full=1 — that path reads no head of its own", async () => {
    state.fetchResult = { archive: { posts: [] }, mediaRefs: [] };
    const res = await get(`handle=henryhudson6&${PAID}`);
    expect(res.status).toBe(200);
    expect(state.headReserved).toBe(0);
    expect(state.calls).not.toContain("head-reserve");
    // Its single head read happens inside fetchXArchive and is covered by the
    // gate's own reservation (RESOURCES_TEXT_ONLY includes the user object).
    expect(state.gatedResources).toEqual([101]);
  });

  it("a bad handle is refused before anything is reserved", async () => {
    const res = await get(`handle=not+a+handle&${PAID}&full=1`);
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });
});
