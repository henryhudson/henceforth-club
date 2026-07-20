import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticateBearer = vi.fn();
const mockGetArchivePost = vi.fn();
const mockRecordTip = vi.fn();
const mockIsBoardLink = vi.fn();
const mockReadLinkRecord = vi.fn();
const mockSameBoundIdentity = vi.fn();

vi.mock("@/lib/kudos/auth", () => ({
  authenticateBearer: (...args: unknown[]) => mockAuthenticateBearer(...args),
}));
vi.mock("@/lib/xArchiveCache", () => ({
  getArchivePost: (...args: unknown[]) => mockGetArchivePost(...args),
}));
vi.mock("@/lib/kudos/tips", () => ({
  recordTip: (...args: unknown[]) => mockRecordTip(...args),
}));
vi.mock("@/lib/folkloreBoard", () => ({
  isBoardLink: (...args: unknown[]) => mockIsBoardLink(...args),
  readLinkRecord: (...args: unknown[]) => mockReadLinkRecord(...args),
}));
vi.mock("@/lib/xOwner", () => ({
  sameBoundIdentity: (...args: unknown[]) => mockSameBoundIdentity(...args),
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
  mockIsBoardLink.mockReset();
  mockReadLinkRecord.mockReset();
  mockSameBoundIdentity.mockReset();
  // Two strangers by default: no shared binding between payer and recipient.
  mockSameBoundIdentity.mockResolvedValue(false);
  // The default world is the archive path: no postId is a board link.
  mockIsBoardLink.mockResolvedValue(false);
  mockReadLinkRecord.mockResolvedValue({ kind: "absent" });
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

  it("refuses a self-kudos — a tip on the payer's own archive — before touching anything", async () => {
    const res = await POST(request({ ...TIP, handle: "henry" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("own-work");
    expect(typeof body.line).toBe("string");
    expect(mockGetArchivePost).not.toHaveBeenCalled();
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses a self-kudos whatever the handle's case", async () => {
    const res = await POST(request({ ...TIP, handle: "Henry" }));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("own-work");
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses a tip on the payer's own continuation post — the thread roll-up cannot be bought", async () => {
    // A continuation post lives in the payer's own archive, so its author —
    // and its thread root's author — is the payer; the one check covers the
    // roll-up-gaming case.
    mockGetArchivePost.mockResolvedValue({
      id: "post-2",
      at: "2026-01-02",
      text: "part two",
      replyToId: "post-1",
    });
    const res = await POST(request({ handle: "henry", postId: "post-2", amount: 5 }));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("own-work");
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses a tip between two handles bound to ONE identity — the alt-account round trip", async () => {
    // The self-dealing route that survives the submit-side binding gate: an
    // operator who genuinely holds two X accounts could bind both, submit
    // under the alt, and tip it from their own float — turning float they
    // funded into a settleable accrual under a name isOwnWork cannot see.
    // Proved sameness is refused; unprovable sameness is not (the test above).
    mockSameBoundIdentity.mockResolvedValue(true);
    const res = await POST(request(TIP));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("own-work");
    expect(mockSameBoundIdentity).toHaveBeenCalledWith("henry", "ben");
    expect(mockGetArchivePost).not.toHaveBeenCalled();
    expect(mockRecordTip).not.toHaveBeenCalled();
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

  it("never consults the board for a postId that cannot be a txid", async () => {
    // The archive path is untouched: an X post id is not 64 hex, so the
    // board lookup is not even reached.
    await POST(request(TIP));
    expect(mockIsBoardLink).not.toHaveBeenCalled();
    expect(mockGetArchivePost).toHaveBeenCalledWith("ben", "post-1");
  });
});

describe("POST /api/folklore/tip — kudos on a board link", () => {
  const TXID = "a".repeat(64);
  const LINK_TIP = { handle: "ben", postId: TXID, amount: 5 };
  const linkRecord = (by?: string) => ({
    kind: "record" as const,
    record: { v: 1, app: "folklore", kind: "link", url: "https://example.com/a", title: "A", ...(by ? { by } : {}) },
  });

  beforeEach(() => {
    mockIsBoardLink.mockResolvedValue(true);
    mockReadLinkRecord.mockResolvedValue(linkRecord("ben"));
  });

  it("records the tip against the link itself — no archive lookup at all", async () => {
    const res = await POST(request(LINK_TIP));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, float: 1995, tipped: 12 });
    // The lookup that made this branch unreachable is skipped, and the tip
    // is recorded against the txid — recordTip's own isBoardLink arm then
    // moves the link's board card rather than a profile's.
    expect(mockGetArchivePost).not.toHaveBeenCalled();
    expect(mockIsBoardLink).toHaveBeenCalledWith(TXID);
    expect(mockRecordTip).toHaveBeenCalledWith("henry", TXID, "ben", 5, expect.any(String));
  });

  it("refuses a self-kudos on the payer's own link before anything is read or debited", async () => {
    const res = await POST(request({ ...LINK_TIP, handle: "henry" }));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("own-work");
    expect(mockReadLinkRecord).not.toHaveBeenCalled();
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses a link tip between two handles bound to one identity", async () => {
    // Same rule on the link half: the submit gate proves `by` is a real bound
    // handle, and this proves the payer is not that handle wearing a hat.
    mockSameBoundIdentity.mockResolvedValue(true);
    const res = await POST(request(LINK_TIP));
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("own-work");
    expect(mockReadLinkRecord).not.toHaveBeenCalled();
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses when the claimed handle is not the link's submitter — money cannot be rerouted", async () => {
    // The link's own record names who gets paid; a payer naming someone else
    // cannot pump a link's kudos while sending the money elsewhere. This is
    // the link half of the archive path's does-the-post-belong-here rule.
    const res = await POST(request({ ...LINK_TIP, handle: "carol" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "not-found" });
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("matches the submitter case-blind, as X handles are", async () => {
    mockReadLinkRecord.mockResolvedValue(linkRecord("Ben"));
    const res = await POST(request(LINK_TIP));
    expect(res.status).toBe(200);
    expect(mockRecordTip).toHaveBeenCalledWith("henry", TXID, "ben", 5, expect.any(String));
  });

  it("refuses a tip on an anonymous link — there is nobody to pay", async () => {
    // A link submitted without a bound handle names no recipient. Debiting
    // the giver with nothing to accrue against would mint a kudos out of the
    // float's conservation invariant, so it refuses instead.
    mockReadLinkRecord.mockResolvedValue(linkRecord(undefined));
    const res = await POST(request(LINK_TIP));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "not-found" });
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses when the cached record is a comment, not a link — comments carry no kudos", async () => {
    mockReadLinkRecord.mockResolvedValue({
      kind: "record",
      record: { v: 1, app: "folklore", kind: "comment", parent: "b".repeat(64), text: "hi", by: "ben" },
    });
    const res = await POST(request(LINK_TIP));
    expect(res.status).toBe(404);
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("relays a record-store outage as unavailable, never as not-found", async () => {
    mockReadLinkRecord.mockResolvedValue({ kind: "unavailable" });
    const res = await POST(request(LINK_TIP));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "unavailable" });
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("keeps every money refusal: an insufficient float still answers 402", async () => {
    mockRecordTip.mockResolvedValue({ kind: "insufficient", float: 2 });
    const res = await POST(request(LINK_TIP));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, reason: "insufficient-float", float: 2 });
  });

  it("still requires a bearer, and still refuses while the flag is off", async () => {
    mockAuthenticateBearer.mockResolvedValue({ kind: "no-token" });
    expect((await POST(request(LINK_TIP))).status).toBe(401);

    vi.stubEnv("KUDOS_ENABLED", "");
    expect((await POST(request(LINK_TIP))).status).toBe(503);
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("falls through to the archive path when the txid is not on the board", async () => {
    mockIsBoardLink.mockResolvedValue(false);
    const res = await POST(request(LINK_TIP));
    expect(res.status).toBe(200);
    expect(mockGetArchivePost).toHaveBeenCalledWith("ben", TXID);
    expect(mockReadLinkRecord).not.toHaveBeenCalled();
  });
});
