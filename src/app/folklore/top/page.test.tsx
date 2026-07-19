import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { dateKey } from "@/lib/redis";

const mockReadKudosReceived = vi.fn();
const mockGetArchivePost = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/kudos/received", () => ({
  readKudosReceived: (...args: unknown[]) => mockReadKudosReceived(...args),
}));
vi.mock("@/lib/xArchiveCache", () => ({
  getArchivePost: (...args: unknown[]) => mockGetArchivePost(...args),
}));

import TopPage from "./page";

// Ann's self-reply thread: p2 continues p1. p3 replies to a post that was
// never archived, so it roots at itself.
const ANN_POSTS: Record<string, { id: string; at: string; text: string; replyToId?: string }> = {
  p1: { id: "p1", at: "2026-07-01T00:00:00Z", text: "part one of the thread" },
  p2: { id: "p2", at: "2026-07-02T00:00:00Z", text: "part two of the thread", replyToId: "p1" },
  p3: { id: "p3", at: "2026-07-03T00:00:00Z", text: "a reply to someone else", replyToId: "gone" },
};

const render = (day?: string) =>
  TopPage({ searchParams: Promise.resolve(day === undefined ? {} : { day }) }).then(
    renderToStaticMarkup,
  );

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("KUDOS_ENABLED", "true");
  mockReadKudosReceived.mockReset();
  mockGetArchivePost.mockReset();
  mockReadKudosReceived.mockResolvedValue([]);
  mockGetArchivePost.mockImplementation(async (handle: string, postId: string) =>
    handle === "ann" ? (ANN_POSTS[postId] ?? null) : null,
  );
});

describe("/folklore/top — the flag gate", () => {
  it("is not found while KUDOS_ENABLED is not exactly \"true\"", async () => {
    vi.stubEnv("KUDOS_ENABLED", "");
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");

    vi.stubEnv("KUDOS_ENABLED", "1");
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockReadKudosReceived).not.toHaveBeenCalled();
  });
});

describe("/folklore/top — the daily chart", () => {
  it("shows today by default, and an honest empty state on a day nobody gave", async () => {
    const html = await render();
    expect(mockReadKudosReceived).toHaveBeenCalledWith(dateKey());
    expect(html).toContain("No kudos landed");
  });

  it("charts a thread as one unit — continuation post first, then its root, both linked", async () => {
    mockReadKudosReceived.mockResolvedValue([
      { postId: "p2", author: "ann", amount: 5, kind: "tip" },
      { postId: "p1", author: "ann", amount: 3, kind: "duel" },
    ]);
    const html = await render();

    // One unit, the day's total on it.
    expect(html).toContain("✦ 8");
    expect(html).toContain("@ann");
    // The continuation renders above the thread root.
    const continuation = html.indexOf("part two of the thread");
    const root = html.indexOf("part one of the thread");
    expect(continuation).toBeGreaterThan(-1);
    expect(root).toBeGreaterThan(-1);
    expect(continuation).toBeLessThan(root);
    // Both link to their permalinks.
    expect(html).toContain("/folklore/ann/p2");
    expect(html).toContain("/folklore/ann/p1");
  });

  it("ranks separate units by kudos received that day", async () => {
    mockReadKudosReceived.mockResolvedValue([
      { postId: "p1", author: "ann", amount: 2, kind: "tip" },
      { postId: "p3", author: "ann", amount: 9, kind: "tip" },
    ]);
    const html = await render();
    const bigger = html.indexOf("a reply to someone else");
    const smaller = html.indexOf("part one of the thread");
    expect(bigger).toBeGreaterThan(-1);
    expect(smaller).toBeGreaterThan(-1);
    expect(bigger).toBeLessThan(smaller);
  });

  it("navigates past days: a valid ?day reads that day's stream", async () => {
    await render("2026-07-01");
    expect(mockReadKudosReceived).toHaveBeenCalledWith("2026-07-01");
  });

  it("falls back to today on a malformed ?day", async () => {
    await render("not-a-day");
    expect(mockReadKudosReceived).toHaveBeenCalledWith(dateKey());
  });
});
