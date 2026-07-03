import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { getArchivePage } from "@/lib/xArchiveCache";

vi.mock("@/lib/xArchiveCache", () => ({
  getArchivePage: vi.fn(),
  PAGE_SIZE: 30,
}));

const mockGetArchivePage = vi.mocked(getArchivePage);

function req(qs: string): Request {
  return new Request(`http://localhost/api/x/posts?${qs}`);
}

beforeEach(() => {
  mockGetArchivePage.mockReset();
});

describe("GET /api/x/posts", () => {
  it("rejects a handle with characters X handles can't contain", async () => {
    const res = await GET(req("handle=bad!handle&offset=0"));
    expect(res.status).toBe(400);
    expect(mockGetArchivePage).not.toHaveBeenCalled();
  });

  it("rejects an empty handle", async () => {
    const res = await GET(req("handle=&offset=0"));
    expect(res.status).toBe(400);
  });

  it("rejects a non-integer offset", async () => {
    const res = await GET(req("handle=henry&offset=abc"));
    expect(res.status).toBe(400);
  });

  it("rejects a fractional offset", async () => {
    const res = await GET(req("handle=henry&offset=1.5"));
    expect(res.status).toBe(400);
  });

  it("rejects a negative offset", async () => {
    const res = await GET(req("handle=henry&offset=-1"));
    expect(res.status).toBe(400);
  });

  it("defaults offset to zero when it's omitted", async () => {
    mockGetArchivePage.mockResolvedValue({
      posts: [],
      postCount: 0,
      profile: { handle: "henry" },
      latestTxid: null,
      txTimes: {},
    });
    const res = await GET(req("handle=henry"));
    expect(res.status).toBe(200);
    expect(mockGetArchivePage).toHaveBeenCalledWith("henry", 0, 30);
  });

  it("rejects any mode other than latest", async () => {
    const res = await GET(req("handle=henry&offset=0&mode=oldest"));
    expect(res.status).toBe(400);
    expect(mockGetArchivePage).not.toHaveBeenCalled();
  });

  it("accepts mode=latest explicitly", async () => {
    mockGetArchivePage.mockResolvedValue({
      posts: [],
      postCount: 0,
      profile: { handle: "henry" },
      latestTxid: null,
      txTimes: {},
    });
    const res = await GET(req("handle=henry&offset=0&mode=latest"));
    expect(res.status).toBe(200);
  });

  it("404s for a handle with no archive", async () => {
    mockGetArchivePage.mockResolvedValue(null);
    const res = await GET(req("handle=henry&offset=30"));
    expect(res.status).toBe(404);
  });

  it("serves a page of posts for a valid request, including the archive's known transaction times", async () => {
    mockGetArchivePage.mockResolvedValue({
      posts: [{ id: "1", at: "t", text: "hi", txid: "abc" }],
      postCount: 100,
      profile: { handle: "henry" },
      latestTxid: "abc",
      txTimes: { abc: 1751328000 },
    });
    const res = await GET(req("handle=henry&offset=30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      posts: [{ id: "1", at: "t", text: "hi", txid: "abc" }],
      offset: 30,
      postCount: 100,
      txTimes: { abc: 1751328000 },
    });
    expect(mockGetArchivePage).toHaveBeenCalledWith("henry", 30, 30);
  });

  it("strips a leading @ from the handle", async () => {
    mockGetArchivePage.mockResolvedValue({
      posts: [],
      postCount: 0,
      profile: { handle: "henry" },
      latestTxid: null,
      txTimes: {},
    });
    await GET(req("handle=%40henry&offset=0"));
    expect(mockGetArchivePage).toHaveBeenCalledWith("henry", 0, 30);
  });
});
