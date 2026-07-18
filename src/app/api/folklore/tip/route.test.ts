import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticateBearer = vi.fn();
const mockGetArchivePost = vi.fn();
const mockRecordTip = vi.fn();

vi.mock("@/lib/kudos/auth", () => ({
  authenticateBearer: (...args: unknown[]) => mockAuthenticateBearer(...args),
}));
vi.mock("@/lib/xArchiveCache", () => ({
  getArchivePost: (...args: unknown[]) => mockGetArchivePost(...args),
}));
vi.mock("@/lib/kudos/tips", () => ({
  recordTip: (...args: unknown[]) => mockRecordTip(...args),
}));

import { POST } from "./route";

function request(body: unknown): Request {
  return new Request("http://x/api/folklore/tip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const TIP = { handle: "ben", postId: "post-1", amount: 5 };

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("KUDOS_ENABLED", "true");
  mockAuthenticateBearer.mockReset();
  mockGetArchivePost.mockReset();
  mockRecordTip.mockReset();
  mockAuthenticateBearer.mockResolvedValue({
    kind: "authenticated",
    profile: "henry",
    token: "token-abc",
  });
  mockGetArchivePost.mockResolvedValue({ id: "post-1", at: "2026-01-01", text: "hello" });
  mockRecordTip.mockResolvedValue({ kind: "recorded", float: 1995, tipped: 12, priority: 5 });
});

describe("POST /api/folklore/tip", () => {
  it("refuses cleanly while KUDOS_ENABLED is not exactly \"true\"", async () => {
    vi.stubEnv("KUDOS_ENABLED", "");
    const res = await POST(request(TIP));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(mockAuthenticateBearer).not.toHaveBeenCalled();
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses without a bearer token, and with an unknown one", async () => {
    mockAuthenticateBearer.mockResolvedValue({ kind: "no-token" });
    expect((await POST(request(TIP))).status).toBe(401);

    mockAuthenticateBearer.mockResolvedValue({ kind: "unknown-token" });
    expect((await POST(request(TIP))).status).toBe(401);
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("records a tip: giver's float debited, post's count ticked, author accrued", async () => {
    const res = await POST(request(TIP));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, float: 1995, tipped: 12 });
    expect(mockGetArchivePost).toHaveBeenCalledWith("ben", "post-1");
    expect(mockRecordTip).toHaveBeenCalledWith("henry", "post-1", "ben", 5, expect.any(String));
  });

  it.each([
    ["missing handle", { postId: "post-1", amount: 5 }],
    ["bad handle", { ...TIP, handle: "not a handle!" }],
    ["missing postId", { handle: "ben", amount: 5 }],
    ["empty postId", { ...TIP, postId: "" }],
    ["zero amount", { ...TIP, amount: 0 }],
    ["negative amount", { ...TIP, amount: -5 }],
    ["fractional amount", { ...TIP, amount: 1.5 }],
    ["non-numeric amount", { ...TIP, amount: "5" }],
  ])("refuses bad input (%s) before touching money", async (_label, body) => {
    const res = await POST(request(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-input" });
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses a malformed (non-JSON) body without throwing", async () => {
    const res = await POST(
      new Request("http://x/api/folklore/tip", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-input" });
  });

  it("refuses a tip on a post the handle's archive does not contain — kudos only reach real authors", async () => {
    mockGetArchivePost.mockResolvedValue(null);
    const res = await POST(request(TIP));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "not-found" });
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("relays an insufficient float as payment required", async () => {
    mockRecordTip.mockResolvedValue({ kind: "insufficient", float: 2 });
    const res = await POST(request(TIP));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, reason: "insufficient-float", float: 2 });
  });

  it("reports unavailable when the money path has no Redis", async () => {
    mockRecordTip.mockResolvedValue({ kind: "unavailable" });
    const res = await POST(request(TIP));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "unavailable" });
  });
});
