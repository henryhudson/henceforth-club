import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory fakes for the input/output boundaries, register-route pattern.
const state = {
  head: null as { postCount: number } | null,
  /** When set, the head read THROWS instead of resolving. */
  headThrows: null as Error | null,
  fetchResult: null as { archive: { posts: unknown[] }; mediaRefs: unknown[] } | null,
  /** What the route handed to the archive read — the head must PASS THROUGH. */
  archiveArgs: [] as { head: unknown; maxPages: number }[],
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
    if (state.headThrows) throw state.headThrows;
    return state.head;
  },
  fetchXArchive: async (head: unknown, _token: string, maxPages: number) => {
    state.archiveArgs.push({ head, maxPages });
    return state.fetchResult;
  },
  pagesForPostCount: (n: number) => Math.max(1, Math.ceil(n / 100)),
  X_TIMELINE_CEILING: 3200,
}));
vi.mock("@/lib/xGate", () => ({
  payAndReserve: async (_payment: string | null, resources: number) => {
    state.calls.push("gate");
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
  state.headThrows = null;
  state.fetchResult = null;
  state.archiveArgs.length = 0;
  state.gateOk = true;
  state.gatedResources.length = 0;
  state.released.length = 0;
  state.headReserve = null;
  state.headReserved = 0;
  state.headReleased = 0;
  state.calls.length = 0;
});

describe("GET /api/x/archive — budget settlement", () => {
  it("hands the reservation back when the head read fails AFTER the gate (the post-burn no-user arm)", async () => {
    // The one-page path sizes nothing in advance, so its single head read lands
    // behind the gate — and when X returns no user there, the payment is already
    // burned and the budget already reserved.
    state.head = null;
    const res = await get(`handle=henryhudson6&${PAID}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "no-user" });
    // The reservation the gate took (posts + 1 = 101) is released in full —
    // the day's budget must not shrink for a read that never happened.
    expect(state.gatedResources).toEqual([101]);
    expect(state.released).toEqual([101]);
    // The head ceiling is the FULL path's bucket; this path never touches it.
    expect(state.headReserved).toBe(0);
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

  it("does not touch the head ceiling at all without full=1 — that path's head read waits for the gate", async () => {
    state.fetchResult = { archive: { posts: [] }, mediaRefs: [] };
    const res = await get(`handle=henryhudson6&${PAID}`);
    expect(res.status).toBe(200);
    expect(state.headReserved).toBe(0);
    expect(state.calls).not.toContain("head-reserve");
    // Its single head read happens in the route AFTER the gate and is covered by
    // the gate's own reservation (`resourcesForPosts` includes the user object).
    expect(state.calls).toEqual(["gate", "head-read"]);
    expect(state.gatedResources).toEqual([101]);
  });

  it("a bad handle is refused before anything is reserved", async () => {
    const res = await get(`handle=not+a+handle&${PAID}&full=1`);
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it("DEMANDS A WELL-FORMED PAYMENT ID BEFORE the billed read — a bare browser request cannot reach the bucket", async () => {
    // The gate cannot run yet (it needs a fee sized from the post count this
    // read exists to discover), so the gate's own free first act is duplicated
    // here on purpose. Without it, `?handle=x&full=1` in an address bar spends
    // half a cent and a slot of the day's ceiling.
    const res = await get("handle=henryhudson6&full=1");
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, reason: "payment-required" });
    expect(state.calls).toEqual([]);
    expect(state.headReserved).toBe(0);
  });

  it("refuses a malformed payment id before the billed read too", async () => {
    const res = await get("handle=henryhudson6&payment=not-a-txid&full=1");
    expect(res.status).toBe(402);
    expect(state.calls).toEqual([]);
  });

  it("HANDS THE RESERVATION BACK when the read THROWS — a request that never completed billed nothing", async () => {
    state.headThrows = new Error("fetch failed");
    await expect(get(`handle=henryhudson6&${PAID}&full=1`)).rejects.toThrow("fetch failed");
    expect(state.headReserved).toBe(1);
    expect(state.headReleased).toBe(1);
  });
});

describe("GET /api/x/archive — one head read per archive", () => {
  // Until 2026-08-06 fetchXArchive re-read the head internally, so a full
  // archive billed TWO user objects for one profile — the route's own comments
  // admitted it. The head is now an ARGUMENT to fetchXArchive; these tests pin
  // both halves: exactly one read, and the read's result passed through.
  it("a full archive reads the head EXACTLY once and hands that head to the timeline read", async () => {
    state.fetchResult = { archive: { posts: [] }, mediaRefs: [] };
    const res = await get(`handle=henryhudson6&${PAID}&full=1`);
    expect(res.status).toBe(200);
    expect(state.calls.filter((c) => c === "head-read")).toHaveLength(1);
    expect(state.archiveArgs).toHaveLength(1);
    expect(state.archiveArgs[0].head).toBe(state.head); // the same object, not a re-fetch
    expect(state.archiveArgs[0].maxPages).toBe(5); // 500 posts, 100 a page
  });

  it("a one-page archive reads the head exactly once too", async () => {
    state.fetchResult = { archive: { posts: [] }, mediaRefs: [] };
    const res = await get(`handle=henryhudson6&${PAID}`);
    expect(res.status).toBe(200);
    expect(state.calls.filter((c) => c === "head-read")).toHaveLength(1);
    expect(state.archiveArgs).toHaveLength(1);
    expect(state.archiveArgs[0].head).toBe(state.head);
    expect(state.archiveArgs[0].maxPages).toBe(1);
  });
});
