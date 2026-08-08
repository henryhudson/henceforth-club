import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadOwner = vi.fn();
const mockVerifyClaim = vi.fn();
const mockCreateJob = vi.fn();
const mockListJobsInState = vi.fn();
const mockReadPass = vi.fn();
const mockGbpPerBsv = vi.fn();

vi.mock("@/lib/xOwner", () => ({
  readOwner: (...args: unknown[]) => mockReadOwner(...args),
}));
vi.mock("@/lib/xBinding", () => ({
  verifyClaim: (...args: unknown[]) => mockVerifyClaim(...args),
}));
vi.mock("@/lib/folkloreJob/jobStore", () => ({
  createJob: (...args: unknown[]) => mockCreateJob(...args),
  listJobsInState: (...args: unknown[]) => mockListJobsInState(...args),
}));
// Only the store read is mocked; the pure pass module (quote, record shape,
// messages) runs for real so the test pins the actual pricing.
vi.mock("@/lib/folkloreJob/pass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/folkloreJob/pass")>()),
  readPass: (...args: unknown[]) => mockReadPass(...args),
}));
vi.mock("@/lib/xPrice", () => ({
  gbpPerBsv: (...args: unknown[]) => mockGbpPerBsv(...args),
}));

import { POST } from "./route";
import { encodeEndowment, endowmentRecord } from "@/lib/folkloreJob/pass";
import { estimateSingleOpReturn } from "@/lib/archiveCost";

function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request("http://x/api/folklore/pass", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const OWNER = {
  address: "1CommittedAddr",
  pubkey: "02abc",
  boundAt: 1,
  bindingTxid: "bindtx",
  bindingPostId: "1",
};
const VALID_BODY = { handle: "henry", pubkey: "02abc", signature: "c2ln" };
const JOB = {
  jobId: "pass-job-1",
  kind: "pass" as const,
  handle: "henry",
  contentHash: "hash",
  feeSats: 36,
  premiumSats: 30_000_000,
  priceSats: 30_000_036,
  state: "quoted" as const,
  createdAtMs: 1_700_000_000_000,
  expiresAtMs: 1_700_000_900_000,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FOLKLORE_ENDOWED_PASS_ENABLED", "true");
  vi.stubEnv("XFOLKLORE_WEB_ARCHIVE_ENABLED", "true");
  mockReadOwner.mockReset();
  mockVerifyClaim.mockReset();
  mockCreateJob.mockReset();
  mockListJobsInState.mockReset();
  mockReadPass.mockReset();
  mockGbpPerBsv.mockReset();
  mockReadOwner.mockResolvedValue({ kind: "owner", owner: OWNER });
  mockVerifyClaim.mockReturnValue(true);
  mockCreateJob.mockResolvedValue({ ok: true, job: JOB });
  mockListJobsInState.mockResolvedValue([]);
  mockReadPass.mockResolvedValue({ kind: "absent" });
  mockGbpPerBsv.mockResolvedValue(10);
});

describe("POST /api/folklore/pass — flag-dark refusal", () => {
  it("refuses while FOLKLORE_ENDOWED_PASS_ENABLED is unset — nothing pass-shaped is reachable", async () => {
    vi.stubEnv("FOLKLORE_ENDOWED_PASS_ENABLED", "");
    const res = await post(VALID_BODY);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(mockReadOwner).not.toHaveBeenCalled();
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("refuses for any flag value other than the exact string true", async () => {
    for (const value of ["1", "TRUE", "yes", "false"]) {
      vi.stubEnv("FOLKLORE_ENDOWED_PASS_ENABLED", value);
      expect((await post(VALID_BODY)).status).toBe(503);
    }
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("refuses while the web-archive surface itself is dark — a pass must never be sold for a service that cannot run", async () => {
    vi.stubEnv("XFOLKLORE_WEB_ARCHIVE_ENABLED", "false");
    const res = await post(VALID_BODY);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});

describe("POST /api/folklore/pass — input and binding gates", () => {
  it("refuses an oversized request by content-length before reading the body", async () => {
    const res = await post(VALID_BODY, { "content-length": String(64 * 1024) });
    expect(res.status).toBe(413);
    expect(mockReadOwner).not.toHaveBeenCalled();
  });

  it("refuses malformed JSON as bad-input, without throwing", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-input" });
  });

  it("refuses a handle that could not be an X handle", async () => {
    for (const handle of ["", "way-too-long-for-x-handle", "bad handle", "a".repeat(16)]) {
      const res = await post({ ...VALID_BODY, handle });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, reason: "bad-handle" });
    }
  });

  it("refuses a purchase with no signature — only the bound key may endow", async () => {
    const res = await post({ handle: "henry" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: "unsigned" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("refuses an UNBOUND handle — the pass rides the binding, so there is nothing to endow", async () => {
    mockReadOwner.mockResolvedValue({ kind: "absent" });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: "unbound-handle" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("relays an unreachable store as 503, never a verdict on the handle", async () => {
    mockReadOwner.mockResolvedValue({ kind: "unavailable" });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "store-unavailable" });
  });

  it("verifies the signature against the STORED owner's committed address, over the purchase message", async () => {
    await post(VALID_BODY);
    expect(mockVerifyClaim).toHaveBeenCalledWith({
      message: "folklore-endow:henry",
      signatureBase64: "c2ln",
      pubkeyHex: "02abc",
      committedAddress: "1CommittedAddr",
    });
  });

  it("refuses a signature that does not verify", async () => {
    mockVerifyClaim.mockReturnValue(false);
    const res = await post(VALID_BODY);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-signature" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});

describe("POST /api/folklore/pass — refuse before money", () => {
  it("refuses an already-endowed handle — no second £3 is ever taken", async () => {
    mockReadPass.mockResolvedValue({
      kind: "pass",
      pass: { handle: "henry", jobId: "old", purchasedAtMs: 1, priceSats: 1 },
    });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "already-endowed" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("refuses while a purchase for the same handle is already in flight", async () => {
    mockListJobsInState.mockImplementation(async (state: unknown) =>
      state === "awaiting-payment" ? [{ jobId: "j", kind: "pass", handle: "Henry", state }] : [],
    );
    const res = await post(VALID_BODY);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "purchase-in-flight" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("an in-flight ARCHIVE job for the handle does not block the purchase — only a pass job does", async () => {
    mockListJobsInState.mockImplementation(async (state: unknown) =>
      state === "funded" ? [{ jobId: "j", kind: "archive", handle: "henry", state }] : [],
    );
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
  });

  it("fails closed with price-unavailable when no live rate exists — money is never taken on a guess", async () => {
    mockGbpPerBsv.mockResolvedValue(undefined);
    const res = await post(VALID_BODY);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "price-unavailable" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});

describe("POST /api/folklore/pass — the purchase job", () => {
  it("opens a pass-kind job priced at the endowment record's fee plus £3 at the live rate", async () => {
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      jobId: JOB.jobId,
      priceSats: JOB.priceSats,
      feeSats: JOB.feeSats,
      passSats: 30_000_000, // ceil(1e8 * 3 / 10) — the real quotePass ran
      expiresAtMs: JOB.expiresAtMs,
    });

    const record = endowmentRecord("henry", "1CommittedAddr");
    const expectedFee = estimateSingleOpReturn(encodeEndowment(record).length).minerFeeSats;
    expect(mockCreateJob).toHaveBeenCalledWith(
      { kind: "pass", handle: "henry", contentHash: expect.any(String), archive: record },
      { feeSats: expectedFee, floatSats: 0, premiumSats: 30_000_000, priceSats: expectedFee + 30_000_000 },
      expect.any(Number),
    );
  });

  it("lowercases the handle onto the job and the record", async () => {
    await post({ ...VALID_BODY, handle: "Henry" });
    const [parsed] = mockCreateJob.mock.calls[0];
    expect(parsed.handle).toBe("henry");
    expect(parsed.archive.handle).toBe("henry");
  });

  it("relays a store refusal as 503", async () => {
    mockCreateJob.mockResolvedValue({ ok: false, refused: "at-capacity" });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "at-capacity" });
  });
});
