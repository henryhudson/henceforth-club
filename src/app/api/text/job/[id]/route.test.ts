import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetJob = vi.fn();

vi.mock("@/lib/textJob/jobStore", () => ({
  getJob: (...args: unknown[]) => mockGetJob(...args),
}));

import { GET } from "./route";

function get(id: string) {
  return GET(new Request(`http://x/api/text/job/${id}`), { params: Promise.resolve({ id }) });
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
  mockGetJob.mockReset();
});

describe("GET /api/text/job/[id]", () => {
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
});
