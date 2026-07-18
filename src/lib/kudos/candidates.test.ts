import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListHandles = vi.fn();
const mockGetArchivePage = vi.fn();
const mockReadTipPriorities = vi.fn();
const mockReadRatingTable = vi.fn();

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
vi.mock("@/lib/kudos/ledger", () => ({
  readRatingTable: (...args: unknown[]) => mockReadRatingTable(...args),
}));

import { isArenaEligible, listDealCandidates, readAuthorRatings } from "./candidates";

const DAY = "2026-07-18";

function post(
  id: string,
  text = `text of ${id}`,
  media?: Array<{ type: string; url: string }>,
) {
  return { id, at: "2026-01-01T00:00:00Z", text, ...(media ? { media } : {}) };
}

function page(posts: ReturnType<typeof post>[]) {
  return { posts, postCount: posts.length, profile: {}, latestTxid: "tx", txCount: 1, photoCount: 0, txTimes: {} };
}

beforeEach(() => {
  mockListHandles.mockReset();
  mockGetArchivePage.mockReset();
  mockReadTipPriorities.mockReset();
  mockReadRatingTable.mockReset();
  mockReadTipPriorities.mockResolvedValue({});
  mockReadRatingTable.mockResolvedValue({});
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

  it("includes bare-media posts so videos and photos can earn Elo", async () => {
    mockListHandles.mockResolvedValue([{ handle: "ann", latestMs: 1 }]);
    mockGetArchivePage.mockResolvedValue(
      page([
        post("a1"),
        post("a2", "   "),
        post("a3", ""),
        post("a4", "", [{ type: "video", url: "https://ordfs.example/v.mp4" }]),
        post("a5", "  ", [{ type: "photo", url: "https://ordfs.example/p.jpg" }]),
      ]),
    );

    const pool = await listDealCandidates(DAY);
    expect(pool.map((c) => c.postId)).toEqual(["a1", "a4", "a5"]);
  });
});

describe("isArenaEligible", () => {
  it("accepts caption text, media, or both — rejects empty shells", () => {
    expect(isArenaEligible({ text: "hi", media: undefined })).toBe(true);
    expect(isArenaEligible({ text: "", media: [{ type: "video", url: "u" }] })).toBe(true);
    expect(isArenaEligible({ text: "  ", media: [{ type: "photo", url: "u" }] })).toBe(true);
    expect(isArenaEligible({ text: "", media: undefined })).toBe(false);
    expect(isArenaEligible({ text: "   ", media: [] })).toBe(false);
  });
});

describe("listDealCandidates — empty and missing archives", () => {
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

describe("readAuthorRatings — the directory's author aggregate", () => {
  it("aggregates each author's rated texts through the fold's mean-of-top rule", async () => {
    mockListHandles.mockResolvedValue([
      { handle: "ann", latestMs: 2 },
      { handle: "ben", latestMs: 1 },
    ]);
    mockGetArchivePage.mockImplementation(async (handle: string) =>
      handle === "ann" ? page([post("a1"), post("a2")]) : page([post("b1")]),
    );
    mockReadRatingTable.mockResolvedValue({
      a1: { rating: 1600, duels: 25 },
      a2: { rating: 1400, duels: 5 },
      b1: { rating: 1550, duels: 21 },
    });

    expect(await readAuthorRatings()).toEqual({ ann: 1500, ben: 1550 });
  });

  it("leaves an author with no rated texts absent, never defaulted", async () => {
    mockListHandles.mockResolvedValue([
      { handle: "ann", latestMs: 2 },
      { handle: "ben", latestMs: 1 },
    ]);
    mockGetArchivePage.mockImplementation(async (handle: string) =>
      handle === "ann" ? page([post("a1")]) : page([post("b1")]),
    );
    mockReadRatingTable.mockResolvedValue({ a1: { rating: 1520, duels: 20 } });

    expect(await readAuthorRatings()).toEqual({ ann: 1520 });
  });

  it("uses a given rating table without a second ledger read", async () => {
    mockListHandles.mockResolvedValue([{ handle: "ann", latestMs: 1 }]);
    mockGetArchivePage.mockResolvedValue(page([post("a1")]));

    const ratings = await readAuthorRatings({ a1: { rating: 1510, duels: 22 } });

    expect(ratings).toEqual({ ann: 1510 });
    expect(mockReadRatingTable).not.toHaveBeenCalled();
  });

  it("is empty when Redis is not configured — the directory then keeps its given order", async () => {
    mockListHandles.mockResolvedValue([]);
    expect(await readAuthorRatings()).toEqual({});
  });
});
