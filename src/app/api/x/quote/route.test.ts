import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/x/quote had no tests at all until the unpaid head read was given a
 * ceiling. It is the shipped app's price-discovery step, so every refusal arm
 * added here is a failure mode that app has never seen — which is precisely why
 * each one is pinned below.
 */
const state = {
  head: null as { username: string; postCount: number } | null,
  priceOk: true,
  headReserve: null as null | { ok: false; reason: "budget-exhausted" | "accounting-unavailable" },
  headReserved: 0,
  headReleased: 0,
  /** The ORDER of the billed side effects. */
  calls: [] as string[],
};

vi.mock("@/lib/xfetch", () => ({
  fetchProfileHead: async () => {
    state.calls.push("head-read");
    return state.head;
  },
  pagesForPostCount: (n: number) => Math.max(1, Math.ceil(n / 100)),
  X_TIMELINE_CEILING: 3200,
  POSTS_PER_PAGE: 100,
}));
vi.mock("@/lib/xGate", () => ({ resourcesForPosts: (posts: number) => posts + 1 }));
vi.mock("@/lib/xSpend", () => ({ resourcesToUsd: (n: number) => n * 0.005 }));
vi.mock("@/lib/xPrice", () => ({
  bsvUsd: async () => {
    state.calls.push("price");
    return state.priceOk ? { ok: true, bsvUsd: 50 } : { ok: false, reason: "rate-unreadable" };
  },
  satsForUsd: (usd: number) => Math.ceil(usd * 1e8 / 50),
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

const get = (query: string) => GET(new Request(`http://x/api/x/quote?${query}`));

beforeEach(() => {
  process.env.X_BEARER_TOKEN = "test-token";
  state.head = { username: "henryhudson6", postCount: 1498 };
  state.priceOk = true;
  state.headReserve = null;
  state.headReserved = 0;
  state.headReleased = 0;
  state.calls.length = 0;
});

describe("GET /api/x/quote — the quote itself", () => {
  it("quotes a profile, keeping the half-cent it really spent", async () => {
    const res = await get("handle=henryhudson6");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.handle).toBe("henryhudson6");
    expect(body.postCount).toBe(1498);
    expect(body.readablePosts).toBe(1498);
    // The head was read, so its reservation stands. A quote that released it
    // would let unlimited quotes cost unlimited money again.
    expect(state.headReserved).toBe(1);
    expect(state.headReleased).toBe(0);
  });

  it("quotes only what X will actually serve, capping at the timeline ceiling", async () => {
    state.head = { username: "big", postCount: 99_000 };
    const body = await (await get("handle=big")).json();
    expect(body.postCount).toBe(99_000);
    expect(body.readablePosts).toBe(3200);
  });
});

describe("GET /api/x/quote — the unpaid head ceiling", () => {
  it("BOOKS THE READ BEFORE MAKING IT", async () => {
    await get("handle=henryhudson6");
    expect(state.calls.indexOf("head-reserve")).toBeLessThan(state.calls.indexOf("head-read"));
  });

  it("an exhausted head budget refuses 429 WITHOUT touching X", async () => {
    state.headReserve = { ok: false, reason: "budget-exhausted" };
    const res = await get("handle=henryhudson6");
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, reason: "budget-exhausted" });
    expect(state.calls).not.toContain("head-read");
  });

  it("refuses 503 when the spend cannot be accounted for — fails CLOSED", async () => {
    state.headReserve = { ok: false, reason: "accounting-unavailable" };
    const res = await get("handle=henryhudson6");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "accounting-unavailable" });
    expect(state.calls).not.toContain("head-read");
  });

  it("HANDS THE RESERVATION BACK for a handle that does not exist — X returned nothing, so X billed nothing", async () => {
    // Without this, nonsense handles would be a free way to pin the day's
    // ceiling: the handle pattern admits any 1-15 character alphanumeric string.
    state.head = null;
    const res = await get("handle=zzzz1");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "no-user" });
    expect(state.headReserved).toBe(1);
    expect(state.headReleased).toBe(1);
  });
});

describe("GET /api/x/quote — refusals that must not cost anything", () => {
  it("reserves nothing for a malformed handle", async () => {
    const res = await get("handle=this+is+not+a+handle");
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it("reserves nothing when no handle is given at all", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it("reserves nothing when the server token is unset", async () => {
    delete process.env.X_BEARER_TOKEN;
    const res = await get("handle=henryhudson6");
    expect(res.status).toBe(503);
    expect(state.calls).toEqual([]);
  });

  it("reserves nothing when the live rate cannot be read — the price check precedes the reservation", async () => {
    // Order matters for a reason: reserving before the price check would let a
    // rate outage silently consume the day's head budget for quotes that can
    // never be returned.
    state.priceOk = false;
    const res = await get("handle=henryhudson6");
    expect(res.status).toBe(503);
    expect(state.headReserved).toBe(0);
    expect(state.calls).toEqual(["price"]);
  });
});
