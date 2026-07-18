import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListHandles = vi.fn();
const mockGetArchivePage = vi.fn();
const mockReadTipPriorities = vi.fn();

vi.mock("@/lib/xIndex", () => ({
  listHandles: (...args: unknown[]) => mockListHandles(...args),
}));
vi.mock("@/lib/xArchiveCache", () => ({
  PAGE_SIZE: 30,
  getArchivePage: (...args: unknown[]) => mockGetArchivePage(...args),
}));
vi.mock("@/lib/kudos/tips", () => ({
  readTipPriorities: (...args: unknown[]) => mockReadTipPriorities(...args),
}));

import { listDealCandidates } from "./candidates";

const DAY = "2026-07-18";

function post(id: string, text = `text of ${id}`) {
  return { id, at: "2026-01-01T00:00:00Z", text };
}

function page(posts: ReturnType<typeof post>[]) {
  return { posts, postCount: posts.length, profile: {}, latestTxid: "tx", txCount: 1, photoCount: 0, txTimes: {} };
}

beforeEach(() => {
  mockListHandles.mockReset();
  mockGetArchivePage.mockReset();
  mockReadTipPriorities.mockReset();
  mockReadTipPriorities.mockResolvedValue({});
});

describe("listDealCandidates — the dealer's pool", () => {
  it("assembles each handle's first archive page into candidates with their tip priorities", async () => {
    mockListHandles.mockResolvedValue([
      { handle: "ann", latestMs: 2 },
      { handle: "ben", latestMs: 1 },
    ]);
    mockGetArchivePage.mockImplementation(async (handle: string) =>
      handle === "ann" ? page([post("a1"), post("a2")]) : page([post("b1")]),
    );
    mockReadTipPriorities.mockResolvedValue({ a2: 12 });

    const pool = await listDealCandidates(DAY);

    expect(pool).toEqual([
      { postId: "a1", author: "ann", priority: 0 },
      { postId: "a2", author: "ann", priority: 12 },
      { postId: "b1", author: "ben", priority: 0 },
    ]);
    expect(mockGetArchivePage).toHaveBeenCalledWith("ann", 0, 30);
    expect(mockReadTipPriorities).toHaveBeenCalledWith(["a1", "a2", "b1"], DAY);
  });

  it("skips textless posts — the arena deals texts, not bare media", async () => {
    mockListHandles.mockResolvedValue([{ handle: "ann", latestMs: 1 }]);
    mockGetArchivePage.mockResolvedValue(page([post("a1"), post("a2", "   "), post("a3", "")]));

    const pool = await listDealCandidates(DAY);
    expect(pool.map((c) => c.postId)).toEqual(["a1"]);
  });

  it("contributes nothing for a handle whose archive cannot be read", async () => {
    mockListHandles.mockResolvedValue([
      { handle: "ann", latestMs: 2 },
      { handle: "gone", latestMs: 1 },
    ]);
    mockGetArchivePage.mockImplementation(async (handle: string) =>
      handle === "ann" ? page([post("a1")]) : null,
    );

    const pool = await listDealCandidates(DAY);
    expect(pool.map((c) => c.postId)).toEqual(["a1"]);
  });

  it("is empty when nobody has registered", async () => {
    mockListHandles.mockResolvedValue([]);
    expect(await listDealCandidates(DAY)).toEqual([]);
    expect(mockGetArchivePage).not.toHaveBeenCalled();
  });
});
