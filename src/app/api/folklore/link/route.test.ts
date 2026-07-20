import { beforeEach, describe, expect, it, vi } from "vitest";
import { TITLE_MAX, COMMENT_MAX } from "@/app/folklore/linkRecord";
import { MAX_CONCURRENT_JOBS } from "@/lib/folkloreJob/constants";
import { SUBMIT_QUOTES_PER_ADDRESS } from "@/lib/folkloreJob/submitThrottle";

const mockQuoteLink = vi.fn();
const mockGbpPerBsv = vi.fn();
const mockCreateJob = vi.fn();
const mockReadLinkRecord = vi.fn();

vi.mock("@/lib/folkloreJob/linkQuote", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/folkloreJob/linkQuote")>()),
  quoteLink: (...args: unknown[]) => mockQuoteLink(...args),
}));
vi.mock("@/lib/xPrice", () => ({
  gbpPerBsv: (...args: unknown[]) => mockGbpPerBsv(...args),
}));
vi.mock("@/lib/folkloreJob/jobStore", () => ({
  createJob: (...args: unknown[]) => mockCreateJob(...args),
}));
vi.mock("@/lib/folkloreBoard", () => ({
  readLinkRecord: (...args: unknown[]) => mockReadLinkRecord(...args),
}));
// The throttle itself is NOT mocked — these tests exercise the real one
// against an in-memory counter, so the capacity property is asserted end to
// end at the route rather than against a stub of itself.
const throttleCounters = new Map<string, number>();
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({
    incr: async (key: string) => {
      const next = (throttleCounters.get(key) ?? 0) + 1;
      throttleCounters.set(key, next);
      return next;
    },
    expire: async () => 1,
  }),
}));

import { POST } from "./route";

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/folklore/link", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const PARENT = "ab".repeat(32);
const QUOTE = { feeSats: 41, floatSats: 0, premiumSats: 929_046, priceSats: 929_087 };
const JOB = {
  jobId: "job-link-1",
  handle: "",
  contentHash: "hash",
  feeSats: 41,
  premiumSats: 929_046,
  priceSats: 929_087,
  state: "quoted" as const,
  createdAtMs: 1_700_000_000_000,
  expiresAtMs: 1_700_000_900_000,
};

beforeEach(() => {
  vi.unstubAllEnvs();
  throttleCounters.clear();
  vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "true");
  mockQuoteLink.mockReset();
  mockGbpPerBsv.mockReset();
  mockCreateJob.mockReset();
  mockReadLinkRecord.mockReset();
  mockGbpPerBsv.mockResolvedValue(10.76375);
  mockQuoteLink.mockReturnValue(QUOTE);
  mockCreateJob.mockResolvedValue({ ok: true, job: JOB });
  mockReadLinkRecord.mockResolvedValue({
    kind: "record",
    record: {
      v: 1,
      app: "folklore",
      kind: "link",
      url: "https://example.com",
      title: "parent",
    },
  });
});

describe("POST /api/folklore/link — the gate", () => {
  it("refuses 503 while the flag is unset, before any body read", async () => {
    delete process.env.FOLKLORE_SUBMIT_ENABLED;
    const req = jsonRequest({ kind: "link", url: "https://example.com", title: "t" });
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "not-available" });
    expect(req.bodyUsed).toBe(false);
    expect(mockCreateJob).not.toHaveBeenCalled();
    expect(mockGbpPerBsv).not.toHaveBeenCalled();
  });

  it("refuses 503 on any value other than exactly \"true\"", async () => {
    for (const value of ["false", "1", "TRUE", ""]) {
      vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", value);
      const res = await POST(jsonRequest({ kind: "link", url: "https://example.com", title: "t" }));
      expect(res.status).toBe(503);
    }
  });

  it("refuses an oversized request by content-length before reading the body", async () => {
    const req = jsonRequest({ kind: "link", url: "https://example.com", title: "t" }, {
      "content-length": String(1024 * 1024),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ ok: false, reason: "too-large" });
    expect(req.bodyUsed).toBe(false);
  });
});

describe("POST /api/folklore/link — refusals", () => {
  it("refuses a body that is not JSON, and JSON that is not an object", async () => {
    for (const body of ["not json {{", "42", "\"a string\"", "null"]) {
      const res = await POST(jsonRequest(body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, reason: "bad-input" });
    }
  });

  it("refuses an unknown kind", async () => {
    const res = await POST(jsonRequest({ kind: "poll", url: "https://example.com", title: "t" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-input" });
  });

  it("refuses an oversized title as title-too-long", async () => {
    const res = await POST(
      jsonRequest({ kind: "link", url: "https://example.com", title: "t".repeat(TITLE_MAX + 1) }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "title-too-long" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("refuses an empty or whitespace title as bad-title", async () => {
    const res = await POST(jsonRequest({ kind: "link", url: "https://example.com", title: "   " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-title" });
  });

  it.each(["javascript:alert(1)", "ftp://example.com/file", "not a url"])(
    "refuses a non-http(s) url (%s) as bad-url",
    async (url) => {
      const res = await POST(jsonRequest({ kind: "link", url, title: "a title" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, reason: "bad-url" });
    },
  );

  it("refuses a by that is not an X handle shape", async () => {
    const res = await POST(
      jsonRequest({ kind: "link", url: "https://example.com", title: "t", by: "not a handle!" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-by" });
  });

  it("refuses a malformed comment parent as bad-parent", async () => {
    const res = await POST(jsonRequest({ kind: "comment", parent: "ab".repeat(31), text: "hi" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-parent" });
  });

  it("refuses an oversized comment as comment-too-long", async () => {
    const res = await POST(
      jsonRequest({ kind: "comment", parent: PARENT, text: "c".repeat(COMMENT_MAX + 1) }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "comment-too-long" });
  });

  it("refuses an empty comment as bad-text", async () => {
    const res = await POST(jsonRequest({ kind: "comment", parent: PARENT, text: " " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "bad-text" });
  });

  it("refuses a comment whose parent is not on the board as unknown-parent — no job, no money", async () => {
    mockReadLinkRecord.mockResolvedValue({ kind: "absent" });
    const res = await POST(jsonRequest({ kind: "comment", parent: PARENT, text: "hello" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "unknown-parent" });
    expect(mockReadLinkRecord).toHaveBeenCalledWith(PARENT);
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("relays a store outage on the parent lookup as store-unavailable, never unknown-parent", async () => {
    // The refusal a client is told to act on: 400 unknown-parent says "your
    // request is wrong, do not retry". An unreachable store has said nothing
    // about the parent at all, so it must answer 503 instead.
    mockReadLinkRecord.mockResolvedValue({ kind: "unavailable" });
    const res = await POST(jsonRequest({ kind: "comment", parent: PARENT, text: "hello" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "store-unavailable" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("refuses with price-unavailable when the quote fails closed — no job is opened", async () => {
    mockQuoteLink.mockReturnValue(null);
    const res = await POST(jsonRequest({ kind: "link", url: "https://example.com", title: "t" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "price-unavailable" });
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("relays the store's refusal when the job cannot be created", async () => {
    for (const refused of ["at-capacity", "store-unavailable"] as const) {
      mockCreateJob.mockResolvedValue({ ok: false, refused });
      const res = await POST(jsonRequest({ kind: "link", url: "https://example.com", title: "t" }));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: false, reason: refused });
    }
  });
});

describe("POST /api/folklore/link — the free-submission allowance", () => {
  const linkBody = (title: string) => ({ kind: "link", url: "https://example.com/a", title });
  const from = (address: string, title = "a title") =>
    jsonRequest(linkBody(title), { "x-forwarded-for": address });

  it("four free quote requests cannot deny the pipeline to the next submitter", async () => {
    // The reported attack: four ~60-byte posts open four "quoted" jobs, which
    // are ACTIVE against MAX_CONCURRENT_JOBS — a ceiling shared with the paid
    // archive route — and hold it at capacity for a whole quote expiry, free
    // and repeatable. The allowance stops the flood short of the ceiling.
    const flood = [];
    for (let i = 0; i < MAX_CONCURRENT_JOBS; i += 1) {
      flood.push(await POST(from("10.0.0.1", `flood ${i}`)));
    }

    expect(flood.filter((res) => res.status === 200)).toHaveLength(SUBMIT_QUOTES_PER_ADDRESS);
    expect(flood.filter((res) => res.status === 429).length).toBeGreaterThan(0);
    // Only the allowed ones ever reached job creation, so the flood is
    // holding strictly fewer than all four slots.
    expect(mockCreateJob).toHaveBeenCalledTimes(SUBMIT_QUOTES_PER_ADDRESS);
    expect(SUBMIT_QUOTES_PER_ADDRESS).toBeLessThan(MAX_CONCURRENT_JOBS);

    // And the next submitter — the paid one this pipeline exists for — is
    // quoted and gets a job exactly as if the flood had never happened.
    mockCreateJob.mockClear();
    const paid = await POST(from("198.51.100.9", "a genuine submission"));
    expect(paid.status).toBe(200);
    expect(mockCreateJob).toHaveBeenCalledTimes(1);
  });

  it("names the refusal and says when to come back", async () => {
    for (let i = 0; i < SUBMIT_QUOTES_PER_ADDRESS; i += 1) await POST(from("10.0.0.2", `t${i}`));

    const res = await POST(from("10.0.0.2", "one too many"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, reason: "too-many-submissions" });
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("spends no allowance on a request that could never open a job", async () => {
    // Validation refusals come first, so an honest mistake never costs a slot.
    for (let i = 0; i < 5; i += 1) {
      expect((await POST(from("10.0.0.3", "  "))).status).toBe(400);
    }
    expect((await POST(from("10.0.0.3"))).status).toBe(200);
  });

  it("refuses before fetching a price — a throttled request costs no upstream call", async () => {
    for (let i = 0; i < SUBMIT_QUOTES_PER_ADDRESS; i += 1) await POST(from("10.0.0.4", `t${i}`));
    mockGbpPerBsv.mockClear();

    expect((await POST(from("10.0.0.4", "blocked"))).status).toBe(429);
    expect(mockGbpPerBsv).not.toHaveBeenCalled();
  });
});

describe("POST /api/folklore/link — accepted submissions", () => {
  it("quotes and creates a job for a valid link; the record itself is the payload, the handle stays empty", async () => {
    const res = await POST(
      jsonRequest({ kind: "link", url: "https://example.com/a", title: "  A title  ", by: "henry" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      jobId: JOB.jobId,
      priceSats: JOB.priceSats,
      feeSats: JOB.feeSats,
      floorSats: JOB.premiumSats,
      expiresAtMs: JOB.expiresAtMs,
    });

    const record = { v: 1, app: "folklore", kind: "link", url: "https://example.com/a", title: "A title", by: "henry" };
    expect(mockQuoteLink).toHaveBeenCalledWith(
      new TextEncoder().encode(JSON.stringify(record)).length,
      10.76375,
    );
    expect(mockCreateJob).toHaveBeenCalledWith(
      { kind: "folklore", handle: "", contentHash: expect.stringMatching(/^[0-9a-f]{64}$/), archive: record },
      QUOTE,
      expect.any(Number),
    );
    // A link needs no parent lookup.
    expect(mockReadLinkRecord).not.toHaveBeenCalled();
  });

  it("creates a comment job when the parent is a link on the board", async () => {
    const res = await POST(jsonRequest({ kind: "comment", parent: PARENT, text: "well said" }));
    expect(res.status).toBe(200);
    const record = { v: 1, app: "folklore", kind: "comment", parent: PARENT, text: "well said" };
    expect(mockCreateJob).toHaveBeenCalledWith(
      { kind: "folklore", handle: "", contentHash: expect.stringMatching(/^[0-9a-f]{64}$/), archive: record },
      QUOTE,
      expect.any(Number),
    );
  });

  it("refuses a comment whose cached parent record is itself a comment — threads stay flat", async () => {
    mockReadLinkRecord.mockResolvedValue({
      kind: "record",
      record: {
        v: 1,
        app: "folklore",
        kind: "comment",
        parent: "cd".repeat(32),
        text: "not a link",
      },
    });
    const res = await POST(jsonRequest({ kind: "comment", parent: PARENT, text: "hello" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "unknown-parent" });
  });
});
