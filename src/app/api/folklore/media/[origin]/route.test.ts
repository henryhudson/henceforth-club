import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import { MAX_MEDIA_BYTES } from "../safety";

const mockResolveTxDigest = vi.fn();
const mockHead = vi.fn();
const mockPut = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/xDigest", () => ({
  resolveTxDigest: (...args: unknown[]) => mockResolveTxDigest(...args),
}));
vi.mock("@vercel/blob", () => ({
  head: (...args: unknown[]) => mockHead(...args),
  put: (...args: unknown[]) => mockPut(...args),
}));

import { GET } from "./route";

const DIGEST = { tweetIds: ["1"], mediaPostIds: ["1"] };

/** A fresh well-formed origin per test, so the real /tmp cache the route
 * writes can never leak state between tests or runs. */
const randomOrigin = () => `${randomBytes(32).toString("hex")}_0`;

const get = (origin: string, headers?: Record<string, string>) =>
  GET(new Request(`http://x/api/folklore/media/${origin}`, { headers }), {
    params: Promise.resolve({ origin }),
  });

const gatewayAnswer = (body: string, contentType: string) =>
  new Response(Buffer.from(body), { status: 200, headers: { "content-type": contentType } });

/** An upstream whose declared size already exceeds the cache cap. A stream
 * body, so no auto-computed content-length can shadow the declared one. */
const oversizedAnswer = () =>
  new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024));
      },
    }),
    { status: 200, headers: { "content-length": String(MAX_MEDIA_BYTES + 1) } },
  );

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", undefined);
  vi.stubEnv("BLOB_STORE_ID", undefined);
  vi.stubGlobal("fetch", mockFetch);
  for (const mock of [mockResolveTxDigest, mockHead, mockPut, mockFetch]) mock.mockReset();
  mockResolveTxDigest.mockResolvedValue(DIGEST);
  mockHead.mockRejectedValue(new Error("not stored"));
});

describe("GET /api/folklore/media/[origin] — the archive-store gate", () => {
  it("refuses a malformed origin before consulting anything", async () => {
    const res = await get("not-an-outpoint");
    expect(res.status).toBe(404);
    expect(mockResolveTxDigest).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refuses a well-formed origin whose transaction is no archive of ours — nothing fetched, nothing cached", async () => {
    mockResolveTxDigest.mockResolvedValue(null);
    const origin = randomOrigin();
    const res = await get(origin);
    expect(res.status).toBe(404);
    expect(mockResolveTxDigest).toHaveBeenCalledWith(origin.slice(0, 64));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });
});

describe("the blob path", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "token");
  });

  it("clamps an executable claimed type to an opaque download before storing", async () => {
    mockFetch.mockResolvedValue(gatewayAnswer("<script>alert(1)</script>", "text/html"));
    mockPut.mockResolvedValue({ url: "https://blob.example/media" });
    const res = await get(randomOrigin());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://blob.example/media");
    expect(mockPut.mock.calls[0][2]).toMatchObject({ contentType: "application/octet-stream" });
  });

  it("stores a genuine media type unchanged", async () => {
    mockFetch.mockResolvedValue(gatewayAnswer("mp4 bytes", "video/mp4"));
    mockPut.mockResolvedValue({ url: "https://blob.example/media" });
    await get(randomOrigin());
    expect(mockPut.mock.calls[0][2]).toMatchObject({ contentType: "video/mp4" });
  });

  it("refuses an oversized inscription before it reaches the paid store", async () => {
    mockFetch.mockResolvedValue(oversizedAnswer());
    const res = await get(randomOrigin());
    expect(res.status).toBe(413);
    expect(mockPut).not.toHaveBeenCalled();
  });
});

describe("the /tmp path", () => {
  it("serves a clamped type with nosniff and inline disposition", async () => {
    mockFetch.mockResolvedValue(gatewayAnswer("<h1>not media</h1>", "text/html"));
    const res = await get(randomOrigin());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(await res.text()).toBe("<h1>not media</h1>");
  });

  it("keeps the safety headers on a range answer for genuine media", async () => {
    mockFetch.mockResolvedValue(gatewayAnswer("png bytes here", "image/png"));
    const origin = randomOrigin();
    await get(origin); // first touch populates the disk copy
    const res = await get(origin, { range: "bytes=0-2" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(await res.text()).toBe("png");
  });

  it("refuses an oversized inscription and writes no disk copy", async () => {
    mockFetch.mockResolvedValue(oversizedAnswer());
    const origin = randomOrigin();
    const res = await get(origin);
    expect(res.status).toBe(413);
    await expect(stat(`/tmp/folklore-media-${origin}`)).rejects.toThrow();
  });
});
