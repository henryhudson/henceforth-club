import { beforeEach, describe, expect, it, vi } from "vitest";

const mockParseXExport = vi.fn();
const mockQuoteArchive = vi.fn();
const mockGbpPerBsv = vi.fn();
const mockGetOwner = vi.fn();
const mockCreateJob = vi.fn();

vi.mock("@/lib/folkloreJob/parseExport", () => ({
  parseXExport: (...args: unknown[]) => mockParseXExport(...args),
}));
vi.mock("@/lib/folkloreJob/quote", () => ({
  quoteArchive: (...args: unknown[]) => mockQuoteArchive(...args),
}));
vi.mock("@/lib/xPrice", () => ({
  gbpPerBsv: (...args: unknown[]) => mockGbpPerBsv(...args),
}));
vi.mock("@/lib/xOwner", () => ({
  getOwner: (...args: unknown[]) => mockGetOwner(...args),
}));
vi.mock("@/lib/folkloreJob/jobStore", () => ({
  createJob: (...args: unknown[]) => mockCreateJob(...args),
}));

import { POST } from "./route";

function multipartRequest(fields: Record<string, string> = { zip: "present" }): Request {
  const form = new FormData();
  if ("zip" in fields) {
    form.append("zip", new File([new Uint8Array([1, 2, 3, 4])], "export.zip"));
  }
  for (const [k, v] of Object.entries(fields)) {
    if (k === "zip") continue;
    form.append(k, v);
  }
  return new Request("http://x/api/folklore/job", { method: "POST", body: form });
}

function oversizedRequest(contentLength: number): Request {
  const form = new FormData();
  form.append("zip", new File([new Uint8Array([1, 2, 3, 4])], "export.zip"));
  return new Request("http://x/api/folklore/job", {
    method: "POST",
    headers: { "content-length": String(contentLength) },
    body: form,
  });
}

const PARSED_OK = {
  ok: true as const,
  handle: "henry",
  archive: { v: 1, source: "x", handle: "henry", profile: {}, posts: [] },
  archiveBytes: 1234,
  contentHash: "hash123",
};
const QUOTE = { feeSats: 500, floatSats: 18_581_000, premiumSats: 0, priceSats: 18_581_500 };
const JOB = {
  jobId: "job-1",
  handle: "henry",
  contentHash: "hash123",
  feeSats: 500,
  premiumSats: 0,
  priceSats: 18_581_500,
  state: "quoted" as const,
  createdAtMs: 1_700_000_000_000,
  expiresAtMs: 1_700_000_900_000,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("XFOLKLORE_WEB_ARCHIVE_ENABLED", "true");
  mockParseXExport.mockReset();
  mockQuoteArchive.mockReset();
  mockGbpPerBsv.mockReset();
  mockGbpPerBsv.mockResolvedValue(10.76375);
  mockGetOwner.mockReset();
  mockCreateJob.mockReset();
  mockParseXExport.mockReturnValue(PARSED_OK);
  mockQuoteArchive.mockReturnValue({ kind: "quoted", quote: QUOTE });
  mockGetOwner.mockResolvedValue(null);
  mockCreateJob.mockResolvedValue({ ok: true, job: JOB });
});

describe("POST /api/folklore/job", () => {
  it("refuses when the web-archive flag is not enabled — the pay pipeline stays unreachable", async () => {
    vi.stubEnv("XFOLKLORE_WEB_ARCHIVE_ENABLED", "false");
    const res = await POST(multipartRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(mockParseXExport).not.toHaveBeenCalled();
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("proceeds when the web-archive flag is exactly \"true\"", async () => {
    vi.stubEnv("XFOLKLORE_WEB_ARCHIVE_ENABLED", "true");
    const res = await POST(multipartRequest());
    expect(res.status).toBe(200);
  });

  it("refuses a request with no zip field", async () => {
    const res = await POST(multipartRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "bad-input" });
    expect(mockParseXExport).not.toHaveBeenCalled();
  });

  it("refuses a malformed (non-multipart) body as bad-input, without throwing", async () => {
    const res = await POST(new Request("http://x/api/folklore/job", { method: "POST", body: "not multipart" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "bad-input" });
  });

  it("refuses an oversized request by content-length before parsing", async () => {
    const res = await POST(oversizedRequest(3 * 1024 * 1024));
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "too-large" });
    expect(mockParseXExport).not.toHaveBeenCalled();
  });

  it.each(["bad-zip", "no-tweets-file", "too-large", "no-posts", "no-handle"] as const)(
    "relays the parser's refusal reason (%s) verbatim",
    async (reason) => {
      mockParseXExport.mockReturnValue({ ok: false, reason });
      const res = await POST(multipartRequest());
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body).toEqual({ ok: false, reason });
      expect(mockQuoteArchive).not.toHaveBeenCalled();
      expect(mockCreateJob).not.toHaveBeenCalled();
    },
  );

  it("quotes and creates a job for a valid upload, with claimedHandle false when unclaimed", async () => {
    const res = await POST(multipartRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      jobId: JOB.jobId,
      priceSats: JOB.priceSats,
      feeSats: JOB.feeSats,
      premiumSats: JOB.premiumSats,
      floatSats: QUOTE.floatSats,
      kudosEnabled: false,
      expiresAtMs: JOB.expiresAtMs,
      claimedHandle: false,
    });
    expect(mockQuoteArchive).toHaveBeenCalledWith(PARSED_OK.archiveBytes, 10.76375);
    expect(mockGetOwner).toHaveBeenCalledWith("henry");
    // The archive route stamps its own kind, so the worker classifies a job
    // from the record itself and never by reading the payload the store is
    // built to delete.
    expect(mockCreateJob).toHaveBeenCalledWith(
      { ...PARSED_OK, kind: "archive" },
      QUOTE,
      expect.any(Number),
    );
  });

  it("reports kudosEnabled true only when KUDOS_ENABLED is exactly \"true\" — checked server-side per request", async () => {
    vi.stubEnv("KUDOS_ENABLED", "true");
    const enabled = await (await POST(multipartRequest())).json();
    expect(enabled.kudosEnabled).toBe(true);

    vi.stubEnv("KUDOS_ENABLED", "1");
    const disabled = await (await POST(multipartRequest())).json();
    expect(disabled.kudosEnabled).toBe(false);
  });

  it("refuses with price-unavailable when the quote cannot convert the pound — no job is opened, no address issued", async () => {
    mockQuoteArchive.mockReturnValue({ kind: "rate-unavailable" });
    const res = await POST(multipartRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "price-unavailable" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("refuses distinctly when the £2 float leg falls to dust — the rate is live, the price is the problem", async () => {
    mockQuoteArchive.mockReturnValue({ kind: "price-below-fee" });
    const res = await POST(multipartRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "price-below-fee" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("adds a claimed-handle notice when the handle already has an owner", async () => {
    mockGetOwner.mockResolvedValue({
      address: "1Owner",
      pubkey: "pub",
      boundAt: 1,
      bindingTxid: "t",
      bindingPostId: "1",
    });
    const res = await POST(multipartRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimedHandle).toBe(true);
    expect(typeof body.notice).toBe("string");
    expect(body.notice.length).toBeGreaterThan(0);
  });

  it("never leaks the archive payload in the response", async () => {
    const res = await POST(multipartRequest());
    const body = await res.json();
    expect(body).not.toHaveProperty("archive");
    expect(body).not.toHaveProperty("posts");
  });

  it("refuses when the job store is at capacity", async () => {
    mockCreateJob.mockResolvedValue({ ok: false, refused: "at-capacity" });
    const res = await POST(multipartRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "at-capacity" });
  });
});
