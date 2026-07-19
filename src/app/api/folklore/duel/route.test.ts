import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticateBearer = vi.fn();
const mockListDealCandidates = vi.fn();
const mockReadRatingTable = vi.fn();
const mockAppendDuel = vi.fn();
const mockDealPair = vi.fn();
const mockIssuePairToken = vi.fn();
const mockConsumePairToken = vi.fn();
const mockMarkPairResolved = vi.fn();
const mockReadResolvedPair = vi.fn();
const mockDebitForDuel = vi.fn();
const mockAccrueEarned = vi.fn();
const mockRecordTip = vi.fn();
const mockGetArchivePost = vi.fn();
const mockRecordKudosReceived = vi.fn();
const mockBumpBoardKudos = vi.fn();

vi.mock("@/lib/kudos/auth", () => ({
  authenticateBearer: (...args: unknown[]) => mockAuthenticateBearer(...args),
}));
vi.mock("@/lib/kudos/candidates", () => ({
  listDealCandidates: (...args: unknown[]) => mockListDealCandidates(...args),
}));
vi.mock("@/lib/kudos/ledger", () => ({
  readRatingTable: (...args: unknown[]) => mockReadRatingTable(...args),
  appendDuel: (...args: unknown[]) => mockAppendDuel(...args),
}));
vi.mock("@/lib/kudos/dealer", () => ({
  dealPair: (...args: unknown[]) => mockDealPair(...args),
  issuePairToken: (...args: unknown[]) => mockIssuePairToken(...args),
  consumePairToken: (...args: unknown[]) => mockConsumePairToken(...args),
  markPairResolved: (...args: unknown[]) => mockMarkPairResolved(...args),
  readResolvedPair: (...args: unknown[]) => mockReadResolvedPair(...args),
}));
vi.mock("@/lib/kudos/float", () => ({
  debitForDuel: (...args: unknown[]) => mockDebitForDuel(...args),
  accrueEarned: (...args: unknown[]) => mockAccrueEarned(...args),
}));
vi.mock("@/lib/kudos/tips", () => ({
  recordTip: (...args: unknown[]) => mockRecordTip(...args),
}));
vi.mock("@/lib/xArchiveCache", () => ({
  getArchivePost: (...args: unknown[]) => mockGetArchivePost(...args),
}));
vi.mock("@/lib/kudos/received", () => ({
  recordKudosReceived: (...args: unknown[]) => mockRecordKudosReceived(...args),
}));
// Only the bump is mocked — profileMember stays real, so the tests pin the
// actual member encoding the route hands the board.
vi.mock("@/lib/folkloreBoard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/folkloreBoard")>()),
  bumpBoardKudos: (...args: unknown[]) => mockBumpBoardKudos(...args),
}));

import { GET, POST } from "./route";

const getRequest = () => new Request("http://x/api/folklore/duel");

function postRequest(body: unknown): Request {
  return new Request("http://x/api/folklore/duel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PAIR = {
  profile: "henry",
  a: { postId: "p1", author: "ann" },
  b: { postId: "p2", author: "ben" },
};

const RESOLVE = { token: "tok-1", winnerPostId: "p2", amount: 3 };

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("KUDOS_ENABLED", "true");
  for (const mock of [
    mockAuthenticateBearer,
    mockListDealCandidates,
    mockReadRatingTable,
    mockAppendDuel,
    mockDealPair,
    mockIssuePairToken,
    mockConsumePairToken,
    mockMarkPairResolved,
    mockReadResolvedPair,
    mockDebitForDuel,
    mockAccrueEarned,
    mockRecordTip,
    mockGetArchivePost,
    mockRecordKudosReceived,
    mockBumpBoardKudos,
  ]) {
    mock.mockReset();
  }
  mockBumpBoardKudos.mockResolvedValue(3);
  mockRecordKudosReceived.mockResolvedValue("recorded");
  mockGetArchivePost.mockImplementation(async (_handle: string, postId: string) => ({
    id: postId,
    at: "2026-07-18T00:00:00Z",
    text: `text of ${postId}`,
    media:
      postId === "p1"
        ? [{ type: "video", url: "https://ordfs.example/p1.mp4" }]
        : undefined,
  }));
  mockAuthenticateBearer.mockResolvedValue({
    kind: "authenticated",
    profile: "henry",
    token: "bearer-abc",
  });
  mockReadRatingTable.mockResolvedValue({});
  mockListDealCandidates.mockResolvedValue([
    { postId: "p1", author: "ann", priority: 0 },
    { postId: "p2", author: "ben", priority: 0 },
  ]);
  mockDealPair.mockReturnValue({
    kind: "dealt",
    pair: [
      { postId: "p1", author: "ann", priority: 0 },
      { postId: "p2", author: "ben", priority: 0 },
    ],
    bucket: "ratingAdjacent",
  });
  mockIssuePairToken.mockResolvedValue({ kind: "issued", token: "tok-next" });
  mockConsumePairToken.mockResolvedValue({ kind: "consumed", pair: PAIR });
  mockReadResolvedPair.mockResolvedValue(null);
  mockDebitForDuel.mockResolvedValue({ kind: "recorded", float: 1997 });
  mockAppendDuel.mockResolvedValue({
    kind: "recorded",
    entry: { seq: 1, duelId: "tok-1", winnerPostId: "p2", loserPostId: "p1", day: "2026-07-18" },
  });
  mockAccrueEarned.mockResolvedValue({ kind: "recorded", earned: 3 });
  mockMarkPairResolved.mockResolvedValue("marked");
  mockRecordTip.mockResolvedValue({ kind: "recorded", float: 1994, tipped: 9, priority: 3 });
});

describe("GET /api/folklore/duel — the deal", () => {
  it("refuses cleanly while KUDOS_ENABLED is not exactly \"true\"", async () => {
    vi.stubEnv("KUDOS_ENABLED", "");
    const res = await GET(getRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(mockAuthenticateBearer).not.toHaveBeenCalled();
    expect(mockDealPair).not.toHaveBeenCalled();

    vi.stubEnv("KUDOS_ENABLED", "1");
    expect((await GET(getRequest())).status).toBe(503);
  });

  it("refuses without a bearer token, with an unknown one, and reports a missing Redis", async () => {
    mockAuthenticateBearer.mockResolvedValue({ kind: "no-token" });
    expect((await GET(getRequest())).status).toBe(401);

    mockAuthenticateBearer.mockResolvedValue({ kind: "unknown-token" });
    expect((await GET(getRequest())).status).toBe(401);

    mockAuthenticateBearer.mockResolvedValue({ kind: "unavailable" });
    expect((await GET(getRequest())).status).toBe(503);
    expect(mockDealPair).not.toHaveBeenCalled();
  });

  it("deals a pair and issues its single-use token, bound to the bearer — each side hydrated with text and media for the arena", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      deal: {
        token: "tok-next",
        pair: [
          {
            postId: "p1",
            author: "ann",
            text: "text of p1",
            media: [{ type: "video", url: "https://ordfs.example/p1.mp4" }],
          },
          { postId: "p2", author: "ben", text: "text of p2" },
        ],
      },
    });
    expect(mockIssuePairToken).toHaveBeenCalledWith(PAIR);
    expect(mockGetArchivePost).toHaveBeenCalledWith("ann", "p1");
    expect(mockGetArchivePost).toHaveBeenCalledWith("ben", "p2");
  });

  it("deals with an empty text when the archive cache cannot say — never a failed deal over display data", async () => {
    mockGetArchivePost.mockResolvedValue(null);
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deal.pair.map((side: { text: string }) => side.text)).toEqual(["", ""]);
    expect(body.deal.pair.every((side: { media?: unknown }) => side.media === undefined)).toBe(
      true,
    );
  });

  it("answers a null deal when the pool cannot put up two posts", async () => {
    mockDealPair.mockReturnValue({ kind: "insufficient" });
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deal: null });
    expect(mockIssuePairToken).not.toHaveBeenCalled();
  });

  it("reports unavailable when the token store cannot issue", async () => {
    mockIssuePairToken.mockResolvedValue({ kind: "unavailable" });
    const res = await GET(getRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("POST /api/folklore/duel — the resolution", () => {
  it("refuses cleanly while KUDOS_ENABLED is not exactly \"true\"", async () => {
    vi.stubEnv("KUDOS_ENABLED", "");
    const res = await POST(postRequest(RESOLVE));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(mockAuthenticateBearer).not.toHaveBeenCalled();
    expect(mockConsumePairToken).not.toHaveBeenCalled();
    expect(mockDebitForDuel).not.toHaveBeenCalled();
  });

  it("refuses without a bearer token and with an unknown one", async () => {
    mockAuthenticateBearer.mockResolvedValue({ kind: "no-token" });
    expect((await POST(postRequest(RESOLVE))).status).toBe(401);

    mockAuthenticateBearer.mockResolvedValue({ kind: "unknown-token" });
    expect((await POST(postRequest(RESOLVE))).status).toBe(401);
    expect(mockConsumePairToken).not.toHaveBeenCalled();
  });

  it.each([
    ["missing token", { winnerPostId: "p2", amount: 3 }],
    ["empty token", { ...RESOLVE, token: "" }],
    ["missing winnerPostId", { token: "tok-1", amount: 3 }],
    ["zero amount", { ...RESOLVE, amount: 0 }],
    ["negative amount", { ...RESOLVE, amount: -3 }],
    ["fractional amount", { ...RESOLVE, amount: 1.5 }],
    ["non-numeric amount", { ...RESOLVE, amount: "3" }],
  ])("refuses bad input (%s) before consuming anything", async (_label, body) => {
    const res = await POST(postRequest(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-input" });
    expect(mockConsumePairToken).not.toHaveBeenCalled();
    expect(mockDebitForDuel).not.toHaveBeenCalled();
  });

  it("refuses a malformed (non-JSON) body without throwing", async () => {
    const res = await POST(
      new Request("http://x/api/folklore/duel", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-input" });
  });

  it("resolves a duel: debit the amount, ONE binary duel entry, the amount to the winner's author, next deal in the response", async () => {
    const res = await POST(postRequest({ ...RESOLVE, amount: 7 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      kind: "duel",
      float: 1997,
      next: {
        token: "tok-next",
        pair: [
          {
            postId: "p1",
            author: "ann",
            text: "text of p1",
            media: [{ type: "video", url: "https://ordfs.example/p1.mp4" }],
          },
          { postId: "p2", author: "ben", text: "text of p2" },
        ],
      },
    });

    expect(mockConsumePairToken).toHaveBeenCalledWith("tok-1", "henry");
    expect(mockDebitForDuel).toHaveBeenCalledWith("henry", 7, expect.any(String));
    // The amount is generosity; the rating swing stays binary — the ledger
    // entry carries no amount, and there is exactly one of it.
    expect(mockAppendDuel).toHaveBeenCalledTimes(1);
    expect(mockAppendDuel).toHaveBeenCalledWith({
      duelId: "tok-1",
      winnerPostId: "p2",
      loserPostId: "p1",
      day: expect.any(String),
    });
    expect(mockAccrueEarned).toHaveBeenCalledWith("ben", 7);
    // The winner's day entry for the Top chart — the full amount, no giver.
    expect(mockRecordKudosReceived).toHaveBeenCalledWith(expect.any(String), {
      postId: "p2",
      author: "ben",
      amount: 7,
      kind: "duel",
    });
    expect(mockMarkPairResolved).toHaveBeenCalledWith("tok-1", PAIR);
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("marks the pair resolved BEFORE the board bump — a board failure never strands a burnt token", async () => {
    // The token is consumed and the giver is already debited by this point.
    // With the board bump ahead of the marker, a throw there left a resolved
    // duel with no resolved-pair record: the payer's follow-up tap could not
    // even degrade to a tip, having paid. The marker goes down first.
    mockBumpBoardKudos.mockRejectedValue(new Error("board down"));

    await expect(POST(postRequest(RESOLVE))).rejects.toThrow("board down");

    expect(mockMarkPairResolved).toHaveBeenCalledWith("tok-1", PAIR);
  });

  it("answers a null next deal when the pool has gone thin, without failing the resolved duel", async () => {
    mockDealPair.mockReturnValue({ kind: "insufficient" });
    const res = await POST(postRequest(RESOLVE));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("duel");
    expect(body.next).toBeNull();
  });

  it("refuses another bearer's token — and never debits for the probe", async () => {
    mockConsumePairToken.mockResolvedValue({ kind: "mismatch" });
    const res = await POST(postRequest(RESOLVE));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: "not-yours" });
    expect(mockDebitForDuel).not.toHaveBeenCalled();
    expect(mockAppendDuel).not.toHaveBeenCalled();
    expect(mockRecordTip).not.toHaveBeenCalled();
  });

  it("refuses a winner the dealt pair does not contain — the burned token buys no arbitrary payout", async () => {
    const res = await POST(postRequest({ ...RESOLVE, winnerPostId: "somewhere-else" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "not-in-pair" });
    expect(mockDebitForDuel).not.toHaveBeenCalled();
    expect(mockAppendDuel).not.toHaveBeenCalled();
  });

  describe("self-kudos — crowning your own text is refused", () => {
    // The bearer ben is dealt a pair containing ben's own text (the dealer
    // never sees the viewer, so that happens). Kudos on his own side must
    // refuse; kudos on the opponent still stands.
    beforeEach(() => {
      mockAuthenticateBearer.mockResolvedValue({
        kind: "authenticated",
        profile: "ben",
        token: "bearer-ben",
      });
      mockConsumePairToken.mockResolvedValue({
        kind: "consumed",
        pair: { ...PAIR, profile: "ben" },
      });
    });

    it("refuses crowning your own side — no debit, no duel, no accrual, and the burned token buys nothing", async () => {
      const res = await POST(postRequest(RESOLVE)); // winner p2 — ben's own
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.reason).toBe("own-work");
      expect(typeof body.line).toBe("string");
      expect(mockDebitForDuel).not.toHaveBeenCalled();
      expect(mockAppendDuel).not.toHaveBeenCalled();
      expect(mockAccrueEarned).not.toHaveBeenCalled();
      expect(mockMarkPairResolved).not.toHaveBeenCalled();
      expect(mockRecordTip).not.toHaveBeenCalled();
      expect(mockRecordKudosReceived).not.toHaveBeenCalled();
    });

    it("still lets the bearer crown the opponent — a duel their own text loses", async () => {
      const res = await POST(postRequest({ ...RESOLVE, winnerPostId: "p1" }));
      expect(res.status).toBe(200);
      expect(mockAppendDuel).toHaveBeenCalledWith({
        duelId: "tok-1",
        winnerPostId: "p1",
        loserPostId: "p2",
        day: expect.any(String),
      });
      expect(mockAccrueEarned).toHaveBeenCalledWith("ann", 3);
    });
  });

  it("relays the daily duel cap from the debit — no entry, no accrual", async () => {
    mockDebitForDuel.mockResolvedValue({ kind: "capped" });
    const res = await POST(postRequest(RESOLVE));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, reason: "daily-cap" });
    expect(mockAppendDuel).not.toHaveBeenCalled();
    expect(mockAccrueEarned).not.toHaveBeenCalled();
  });

  it("relays an insufficient float as payment required — no entry, no accrual", async () => {
    mockDebitForDuel.mockResolvedValue({ kind: "insufficient", float: 1 });
    const res = await POST(postRequest(RESOLVE));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, reason: "insufficient-float", float: 1 });
    expect(mockAppendDuel).not.toHaveBeenCalled();
    expect(mockAccrueEarned).not.toHaveBeenCalled();
    expect(mockRecordKudosReceived).not.toHaveBeenCalled();
  });

  it("reports unavailable when the money path has no Redis", async () => {
    mockDebitForDuel.mockResolvedValue({ kind: "unavailable" });
    const res = await POST(postRequest(RESOLVE));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "unavailable" });
    expect(mockAppendDuel).not.toHaveBeenCalled();
  });

  describe("stale tokens — kudos degrade to tips, never a second duel", () => {
    beforeEach(() => {
      mockConsumePairToken.mockResolvedValue({ kind: "refused" });
    });

    it("tips the chosen side of the already-resolved pair — either side, the loser's applause included", async () => {
      mockReadResolvedPair.mockResolvedValue(PAIR);

      const winnerSide = await POST(postRequest({ ...RESOLVE, winnerPostId: "p2", amount: 4 }));
      expect(winnerSide.status).toBe(200);
      expect(await winnerSide.json()).toEqual({ ok: true, kind: "tip", float: 1994, tipped: 9 });
      expect(mockRecordTip).toHaveBeenCalledWith("henry", "p2", "ben", 4, expect.any(String));

      const loserSide = await POST(postRequest({ ...RESOLVE, winnerPostId: "p1", amount: 2 }));
      expect(loserSide.status).toBe(200);
      expect(mockRecordTip).toHaveBeenCalledWith("henry", "p1", "ann", 2, expect.any(String));

      // Never a second duel, whatever the side.
      expect(mockAppendDuel).not.toHaveBeenCalled();
      expect(mockDebitForDuel).not.toHaveBeenCalled();
    });

    it("refuses a self-kudos in the follow-up window — no tip on your own side either", async () => {
      mockAuthenticateBearer.mockResolvedValue({
        kind: "authenticated",
        profile: "ben",
        token: "bearer-ben",
      });
      mockReadResolvedPair.mockResolvedValue({ ...PAIR, profile: "ben" });
      const res = await POST(postRequest({ ...RESOLVE, winnerPostId: "p2" })); // ben's own
      expect(res.status).toBe(403);
      expect((await res.json()).reason).toBe("own-work");
      expect(mockRecordTip).not.toHaveBeenCalled();
    });

    it("refuses a token with no resolved pair behind it — expired or forged, nothing to tip", async () => {
      mockReadResolvedPair.mockResolvedValue(null);
      const res = await POST(postRequest(RESOLVE));
      expect(res.status).toBe(410);
      expect(await res.json()).toEqual({ ok: false, reason: "stale-token" });
      expect(mockRecordTip).not.toHaveBeenCalled();
      expect(mockAppendDuel).not.toHaveBeenCalled();
    });

    it("refuses another bearer's resolved pair", async () => {
      mockReadResolvedPair.mockResolvedValue({ ...PAIR, profile: "mallory" });
      const res = await POST(postRequest(RESOLVE));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, reason: "not-yours" });
      expect(mockRecordTip).not.toHaveBeenCalled();
    });

    it("refuses a post the resolved pair does not contain", async () => {
      mockReadResolvedPair.mockResolvedValue(PAIR);
      const res = await POST(postRequest({ ...RESOLVE, winnerPostId: "somewhere-else" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, reason: "not-in-pair" });
      expect(mockRecordTip).not.toHaveBeenCalled();
    });

    it("relays an insufficient float on the degraded tip", async () => {
      mockReadResolvedPair.mockResolvedValue(PAIR);
      mockRecordTip.mockResolvedValue({ kind: "insufficient", float: 0 });
      const res = await POST(postRequest(RESOLVE));
      expect(res.status).toBe(402);
      expect(await res.json()).toEqual({ ok: false, reason: "insufficient-float", float: 0 });
    });
  });
});
