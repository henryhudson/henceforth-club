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
const mockBoardTop = vi.fn();
const mockReadLinkRecord = vi.fn();
vi.mock("@/lib/folkloreBoard", () => ({
  LINK_SCORE_OFFSET: 0.5,
  boardTop: (...args: unknown[]) => mockBoardTop(...args),
  readLinkRecord: (...args: unknown[]) => mockReadLinkRecord(...args),
}));

import { validateLink } from "@/app/folklore/linkRecord";
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
  mockBoardTop.mockReset();
  mockReadLinkRecord.mockReset();
  mockBoardTop.mockResolvedValue([]);
  mockReadLinkRecord.mockResolvedValue({ kind: "absent" });
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

// ---------------------------------------------------------------------------
// Listed targets — the board's rows join the pool (specification §4)

const TARGET = "ab".repeat(32);
const OTHER_TARGET = "cd".repeat(32);
const STAMP = "ef".repeat(32);

const listed = (target: string, title = "A cello note", by?: string) => {
  const record = validateLink(target, title, by);
  if (!record) throw new Error("fixture record must validate");
  return record;
};

describe("listDealCandidates — listed targets join the pool", () => {
  it("appends each listed target after the archive posts, keyed by the target with its bound handle as author", async () => {
    mockListHandles.mockResolvedValue([{ handle: "ann", latestMs: 1 }]);
    mockGetArchivePage.mockResolvedValue(page([post("a1")]));
    mockBoardTop.mockResolvedValue([
      { member: `link:${TARGET}`, score: 3.5 },
      { member: "profile:ann", score: 2 },
    ]);
    mockReadLinkRecord.mockResolvedValue({
      kind: "record",
      record: listed(TARGET, "A cello note", "henry"),
    });
    mockReadTipPriorities.mockResolvedValue({ [TARGET]: 4 });

    expect(await listDealCandidates(DAY)).toEqual([
      { postId: "a1", author: "ann", priority: 0 },
      { postId: TARGET, author: "henry", priority: 4 },
    ]);
    // The front page's window, and one record read per link member — the
    // profile member inside the window costs nothing.
    expect(mockBoardTop).toHaveBeenCalledWith(100);
    expect(mockReadLinkRecord).toHaveBeenCalledTimes(1);
    expect(mockReadLinkRecord).toHaveBeenCalledWith(TARGET);
  });

  it("deals an anonymous target under an author named from the target — never a handle's shape", async () => {
    mockListHandles.mockResolvedValue([]);
    mockBoardTop.mockResolvedValue([{ member: `link:${TARGET}`, score: 0.5 }]);
    mockReadLinkRecord.mockResolvedValue({ kind: "record", record: listed(TARGET) });

    const pool = await listDealCandidates(DAY);
    expect(pool).toEqual([{ postId: TARGET, author: `anonymous-${TARGET.slice(0, 8)}`, priority: 0 }]);
    expect(pool[0].author).not.toMatch(/^[A-Za-z0-9_]{1,15}$/);
  });

  it("gives two anonymous targets two different authors, so the dealer can pair them", async () => {
    mockListHandles.mockResolvedValue([]);
    mockBoardTop.mockResolvedValue([
      { member: `link:${TARGET}`, score: 1.5 },
      { member: `link:${OTHER_TARGET}`, score: 0.5 },
    ]);
    mockReadLinkRecord.mockImplementation(async (txid: string) => ({
      kind: "record",
      record: listed(txid),
    }));

    const authors = (await listDealCandidates(DAY)).map((c) => c.author);
    expect(new Set(authors).size).toBe(2);
  });

  it("passes over a legacy web-address row — it names no target to deal", async () => {
    mockListHandles.mockResolvedValue([]);
    mockBoardTop.mockResolvedValue([{ member: `link:${STAMP}`, score: 0.5 }]);
    mockReadLinkRecord.mockResolvedValue({
      kind: "record",
      record: listed("https://example.com/a", "Legacy"),
    });

    expect(await listDealCandidates(DAY)).toEqual([]);
  });

  it("deals one target once, whatever the board holds — one row per target", async () => {
    mockListHandles.mockResolvedValue([]);
    mockBoardTop.mockResolvedValue([
      { member: `link:${TARGET}`, score: 1.5 },
      { member: `link:${STAMP}`, score: 0.5 },
    ]);
    mockReadLinkRecord.mockResolvedValue({ kind: "record", record: listed(TARGET) });

    expect((await listDealCandidates(DAY)).map((c) => c.postId)).toEqual([TARGET]);
  });

  it("contributes nothing for a row the store cannot resolve — absent or unreachable", async () => {
    mockListHandles.mockResolvedValue([]);
    mockBoardTop.mockResolvedValue([
      { member: `link:${TARGET}`, score: 1.5 },
      { member: `link:${OTHER_TARGET}`, score: 0.5 },
    ]);
    mockReadLinkRecord.mockImplementation(async (txid: string) =>
      txid === TARGET ? { kind: "unavailable" } : { kind: "absent" },
    );

    expect(await listDealCandidates(DAY)).toEqual([]);
  });
});

describe("readAuthorRatings — listed targets count for their bound handle", () => {
  it("aggregates a handle's listed targets with its archive texts", async () => {
    mockListHandles.mockResolvedValue([{ handle: "henry", latestMs: 1 }]);
    mockGetArchivePage.mockResolvedValue(page([post("h1")]));
    mockBoardTop.mockResolvedValue([{ member: `link:${TARGET}`, score: 0.5 }]);
    mockReadLinkRecord.mockResolvedValue({ kind: "record", record: listed(TARGET, "t", "henry") });
    mockReadRatingTable.mockResolvedValue({
      h1: { rating: 1600, duels: 25 },
      [TARGET]: { rating: 1400, duels: 25 },
    });

    expect(await readAuthorRatings()).toEqual({ henry: 1500 });
  });
});
