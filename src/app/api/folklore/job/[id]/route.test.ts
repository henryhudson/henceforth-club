import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetJob = vi.fn();
const mockIssueFloatOnCompletion = vi.fn();
const mockRecordPassOnCompletion = vi.fn();

vi.mock("@/lib/folkloreJob/jobStore", () => ({
  getJob: (...args: unknown[]) => mockGetJob(...args),
}));
vi.mock("@/lib/folkloreJob/floatFunding", () => ({
  issueFloatOnCompletion: (...args: unknown[]) => mockIssueFloatOnCompletion(...args),
}));
vi.mock("@/lib/folkloreJob/pass", () => ({
  recordPassOnCompletion: (...args: unknown[]) => mockRecordPassOnCompletion(...args),
}));

import { GET } from "./route";

function get(id: string) {
  return GET(new Request(`http://x/api/folklore/job/${id}`), { params: Promise.resolve({ id }) });
}

const BASE_JOB = {
  jobId: "job-1",
  handle: "henry",
  contentHash: "hash123",
  feeSats: 500,
  premiumSats: 9_290_000,
  priceSats: 9_290_500,
  state: "quoted" as const,
  createdAtMs: 1_700_000_000_000,
  expiresAtMs: 1_700_000_900_000,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  mockGetJob.mockReset();
  mockIssueFloatOnCompletion.mockReset();
  mockIssueFloatOnCompletion.mockResolvedValue({ kind: "issued", token: "recovery-1", kudos: 2000 });
  mockRecordPassOnCompletion.mockReset();
  mockRecordPassOnCompletion.mockResolvedValue({ kind: "recorded", pass: { handle: "henry" } });
});

describe("GET /api/folklore/job/[id]", () => {
  it("404s for a job id that does not exist", async () => {
    mockGetJob.mockResolvedValue(null);
    const res = await get("no-such-job");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns state and price fields for a freshly quoted job, without txids or an address", async () => {
    mockGetJob.mockResolvedValue(BASE_JOB);
    const res = await get(BASE_JOB.jobId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      state: "quoted",
      feeSats: BASE_JOB.feeSats,
      premiumSats: BASE_JOB.premiumSats,
      priceSats: BASE_JOB.priceSats,
    });
  });

  it("includes the address once the worker has published a key", async () => {
    mockGetJob.mockResolvedValue({ ...BASE_JOB, state: "awaiting-payment", address: "1Addr" });
    const res = await get(BASE_JOB.jobId);
    const body = await res.json();
    expect(body.state).toBe("awaiting-payment");
    expect(body.address).toBe("1Addr");
  });

  it("includes the inscription transaction id once inscribed", async () => {
    mockGetJob.mockResolvedValue({ ...BASE_JOB, state: "inscribed", inscriptionTxid: "inscribetx" });
    const res = await get(BASE_JOB.jobId);
    const body = await res.json();
    expect(body.inscriptionTxid).toBe("inscribetx");
  });

  it("includes the sweep transaction id once swept", async () => {
    mockGetJob.mockResolvedValue({ ...BASE_JOB, state: "swept", sweepTxid: "sweeptx" });
    const res = await get(BASE_JOB.jobId);
    const body = await res.json();
    expect(body.sweepTxid).toBe("sweeptx");
  });

  it("includes the failure reason once one is recorded", async () => {
    mockGetJob.mockResolvedValue({ ...BASE_JOB, state: "sweeping", failureReason: "mempool-conflict" });
    const res = await get(BASE_JOB.jobId);
    const body = await res.json();
    expect(body.failureReason).toBe("mempool-conflict");
  });

  it("never returns the archive payload", async () => {
    mockGetJob.mockResolvedValue(BASE_JOB);
    const res = await get(BASE_JOB.jobId);
    const body = await res.json();
    expect(body).not.toHaveProperty("archive");
    expect(body).not.toHaveProperty("posts");
    expect(body).not.toHaveProperty("contentHash");
  });

  describe("float funding on completion", () => {
    const DONE_JOB = { ...BASE_JOB, state: "done" as const, premiumSats: 0, priceSats: 19_000, feeSats: 1_000 };

    it("never issues while KUDOS_ENABLED is unset — the whole kudos surface stays unreachable", async () => {
      mockGetJob.mockResolvedValue(DONE_JOB);
      const res = await get(DONE_JOB.jobId);
      const body = await res.json();
      expect(mockIssueFloatOnCompletion).not.toHaveBeenCalled();
      expect(body).not.toHaveProperty("kudosFloat");
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("never issues for any KUDOS_ENABLED value other than the exact string true", async () => {
      vi.stubEnv("KUDOS_ENABLED", "1");
      mockGetJob.mockResolvedValue(DONE_JOB);
      await get(DONE_JOB.jobId);
      expect(mockIssueFloatOnCompletion).not.toHaveBeenCalled();
    });

    it("never issues before the job is done, even with the flag on", async () => {
      vi.stubEnv("KUDOS_ENABLED", "true");
      mockGetJob.mockResolvedValue({ ...DONE_JOB, state: "inscribed" as const });
      await get(DONE_JOB.jobId);
      expect(mockIssueFloatOnCompletion).not.toHaveBeenCalled();
    });

    it("on the first done poll with the flag on: funds the float, returns the recovery string once, and sets the bearer cookie", async () => {
      vi.stubEnv("KUDOS_ENABLED", "true");
      mockGetJob.mockResolvedValue(DONE_JOB);
      const res = await get(DONE_JOB.jobId);
      const body = await res.json();

      expect(mockIssueFloatOnCompletion).toHaveBeenCalledWith(DONE_JOB);
      expect(body.kudosFloat).toEqual({ recoveryString: "recovery-1", kudos: 2000 });

      const cookie = res.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("kudos_token=recovery-1");
      expect(cookie.toLowerCase()).toContain("httponly");
    });

    it("a later poll finds the float already issued: no recovery string again, no cookie — the string renders exactly once", async () => {
      vi.stubEnv("KUDOS_ENABLED", "true");
      mockGetJob.mockResolvedValue(DONE_JOB);
      mockIssueFloatOnCompletion.mockResolvedValue({ kind: "already-issued" });
      const res = await get(DONE_JOB.jobId);
      const body = await res.json();

      expect(body).not.toHaveProperty("kudosFloat");
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("an unavailable store degrades to the plain status response", async () => {
      vi.stubEnv("KUDOS_ENABLED", "true");
      mockGetJob.mockResolvedValue(DONE_JOB);
      mockIssueFloatOnCompletion.mockResolvedValue({ kind: "unavailable" });
      const res = await get(DONE_JOB.jobId);
      expect(res.status).toBe(200);
      expect(await res.json()).not.toHaveProperty("kudosFloat");
    });
  });

  describe("pass recording on completion", () => {
    const DONE_PASS_JOB = { ...BASE_JOB, kind: "pass" as const, state: "done" as const };

    it("never records while FOLKLORE_ENDOWED_PASS_ENABLED is unset — the whole pass surface stays unreachable", async () => {
      mockGetJob.mockResolvedValue(DONE_PASS_JOB);
      const res = await get(DONE_PASS_JOB.jobId);
      expect(res.status).toBe(200);
      expect(mockRecordPassOnCompletion).not.toHaveBeenCalled();
    });

    it("never records for any flag value other than the exact string true", async () => {
      vi.stubEnv("FOLKLORE_ENDOWED_PASS_ENABLED", "1");
      mockGetJob.mockResolvedValue(DONE_PASS_JOB);
      await get(DONE_PASS_JOB.jobId);
      expect(mockRecordPassOnCompletion).not.toHaveBeenCalled();
    });

    it("records the pass once the purchase job is done, with the flag on", async () => {
      vi.stubEnv("FOLKLORE_ENDOWED_PASS_ENABLED", "true");
      mockGetJob.mockResolvedValue(DONE_PASS_JOB);
      const res = await get(DONE_PASS_JOB.jobId);
      expect(res.status).toBe(200);
      expect(mockRecordPassOnCompletion).toHaveBeenCalledWith(DONE_PASS_JOB, expect.any(Number));
    });

    it("never records before the job is done, even with the flag on", async () => {
      vi.stubEnv("FOLKLORE_ENDOWED_PASS_ENABLED", "true");
      mockGetJob.mockResolvedValue({ ...DONE_PASS_JOB, state: "inscribed" as const });
      await get(DONE_PASS_JOB.jobId);
      expect(mockRecordPassOnCompletion).not.toHaveBeenCalled();
    });

    it("never records for a done job of any other kind", async () => {
      vi.stubEnv("FOLKLORE_ENDOWED_PASS_ENABLED", "true");
      mockGetJob.mockResolvedValue({ ...BASE_JOB, kind: "archive" as const, state: "done" as const });
      await get(BASE_JOB.jobId);
      expect(mockRecordPassOnCompletion).not.toHaveBeenCalled();
    });

    it("surfaces the endowed marker on a redeemed job's status", async () => {
      mockGetJob.mockResolvedValue({ ...BASE_JOB, endowed: true as const, priceSats: 0 });
      const body = await (await get(BASE_JOB.jobId)).json();
      expect(body.endowed).toBe(true);
      expect(body.priceSats).toBe(0);
    });
  });
});
