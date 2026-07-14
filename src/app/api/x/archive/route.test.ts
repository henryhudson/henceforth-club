import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory fakes for the input/output boundaries, register-route pattern.
const state = {
  head: null as { postCount: number } | null,
  fetchResult: null as { archive: { posts: unknown[] }; mediaRefs: unknown[] } | null,
  gateOk: true,
  gatedResources: [] as number[],
  released: [] as number[],
};

vi.mock("@/lib/xfetch", () => ({
  fetchProfileHead: async () => state.head,
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

import { GET } from "./route";

const get = (query: string) => GET(new Request(`http://x/api/x/archive?${query}`));

beforeEach(() => {
  process.env.X_BEARER_TOKEN = "test-token";
  state.head = { postCount: 500 };
  state.fetchResult = null;
  state.gateOk = true;
  state.gatedResources.length = 0;
  state.released.length = 0;
});

describe("GET /api/x/archive — budget settlement", () => {
  it("hands the reservation back when the read fails AFTER the gate (the post-burn no-user arm)", async () => {
    state.fetchResult = null; // X refused the timeline after a successful head
    const res = await get("handle=henryhudson6&payment=" + "a".repeat(64) + "&full=1");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "no-user" });
    // The reservation the gate took (posts + 1 = 501) is released in full —
    // the day's budget must not shrink for a read that never happened.
    expect(state.gatedResources).toEqual([501]);
    expect(state.released).toEqual([501]);
  });

  it("keeps the reservation when the read is served — that budget was really spent", async () => {
    state.fetchResult = { archive: { posts: [{ id: "1" }] }, mediaRefs: [] };
    const res = await get("handle=henryhudson6&payment=" + "a".repeat(64) + "&full=1");
    expect(res.status).toBe(200);
    expect(state.released).toEqual([]);
  });

  it("releases nothing on the pre-gate no-user arm — nothing was reserved", async () => {
    state.head = null; // the free head check answers before the gate
    const res = await get("handle=nosuchuser&payment=" + "a".repeat(64) + "&full=1");
    expect(res.status).toBe(404);
    expect(state.gatedResources).toEqual([]);
    expect(state.released).toEqual([]);
  });

  it("releases nothing when the gate itself refuses — payAndReserve settles its own arms", async () => {
    state.gateOk = false;
    const res = await get("handle=henryhudson6&payment=" + "a".repeat(64) + "&full=1");
    expect(res.status).toBe(402);
    expect(state.released).toEqual([]);
  });
});
