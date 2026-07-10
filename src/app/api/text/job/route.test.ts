import { beforeEach, describe, expect, it, vi } from "vitest";

const mockParseXExport = vi.fn();
const mockQuoteArchive = vi.fn();
const mockGetOwner = vi.fn();
const mockCreateJob = vi.fn();

vi.mock("@/lib/textJob/parseExport", () => ({
  parseXExport: (...args: unknown[]) => mockParseXExport(...args),
}));
vi.mock("@/lib/textJob/quote", () => ({
  quoteArchive: (...args: unknown[]) => mockQuoteArchive(...args),
}));
vi.mock("@/lib/xOwner", () => ({
  getOwner: (...args: unknown[]) => mockGetOwner(...args),
}));
vi.mock("@/lib/textJob/jobStore", () => ({
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
  return new Request("http://x/api/text/job", { method: "POST", body: form });
}

function oversizedRequest(contentLength: number): Request {
  const form = new FormData();
  form.append("zip", new File([new Uint8Array([1, 2, 3, 4])], "export.zip"));
  return new Request("http://x/api/text/job", {
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
const QUOTE = { feeSats: 500, premiumSats: 9_290_000, priceSats: 9_290_500 };
const JOB = {
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
  mockParseXExport.mockReset();
  mockQuoteArchive.mockReset();
  mockGetOwner.mockReset();
  mockCreateJob.mockReset();
  mockParseXExport.mockReturnValue(PARSED_OK);
  mockQuoteArchive.mockReturnValue(QUOTE);
  mockGetOwner.mockResolvedValue(null);
  mockCreateJob.mockResolvedValue({ ok: true, job: JOB });
});

describe("POST /api/text/job", () => {
  it("refuses a request with no zip field", async () => {
    const res = await POST(multipartRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "bad-input" });
    expect(mockParseXExport).not.toHaveBeenCalled();
  });

  it("refuses a malformed (non-multipart) body as bad-input, without throwing", async () => {
    const res = await POST(new Request("http://x/api/text/job", { method: "POST", body: "not multipart" }));
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
      expiresAtMs: JOB.expiresAtMs,
      claimedHandle: false,
    });
    expect(mockQuoteArchive).toHaveBeenCalledWith(PARSED_OK.archiveBytes);
    expect(mockGetOwner).toHaveBeenCalledWith("henry");
    expect(mockCreateJob).toHaveBeenCalledWith(PARSED_OK, QUOTE, expect.any(Number));
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
