import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/xArchiveCache", () => ({
  getArchivePage: vi.fn(async (handle: string) =>
    handle === "someone"
      ? {
          profile: { handle: "someone", displayName: "Someone" },
          posts: [{ id: "1", at: "2026-07-01T00:00:00Z", text: "hello", txid: "aa".repeat(32) }],
          postCount: 1,
          txCount: 1,
          txTimes: { ["aa".repeat(32)]: 1_780_000_000 },
          latestTxid: "aa".repeat(32),
          photoCount: 0,
        }
      : null,
  ),
}));

import { GET } from "./route";

describe("the archive export", () => {
  it("hands back the whole archive as a named JSON download", async () => {
    const res = await GET(new Request("http://x/folklore/someone/export"), {
      params: Promise.resolve({ handle: "someone" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="folklore-someone.json"');
    const body = await res.json();
    expect(body.profile.handle).toBe("someone");
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].txid).toBe("aa".repeat(32));
    expect(body.about.verify).toContain("block explorer");
  });

  it("404s for a handle that is not archived", async () => {
    const res = await GET(new Request("http://x/folklore/nobody/export"), {
      params: Promise.resolve({ handle: "nobody" }),
    });
    expect(res.status).toBe(404);
  });
});
