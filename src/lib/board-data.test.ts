import { describe, it, expect, vi, beforeEach } from "vitest";
import { promises as fs } from "fs";
import { getRedis } from "@/lib/redis";
import { readFromHead, resolveHead } from "./chain-archive";
import { listDates, loadBoard, loadBoardResult, loadGardening, resetChainMemoForTests } from "./board-data";

vi.mock("@/lib/redis", () => ({ getRedis: vi.fn() }));
vi.mock("fs", () => ({ promises: { readFile: vi.fn(), readdir: vi.fn() } }));
vi.mock("./chain-archive", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./chain-archive")>()),
  resolveHead: vi.fn(),
  readFromHead: vi.fn(),
}));

const mockGetRedis = vi.mocked(getRedis);
const mockReadFile = vi.mocked(fs.readFile);
const mockResolveHead = vi.mocked(resolveHead);
const mockReadFromHead = vi.mocked(readFromHead);

const board = { generated: "now", cards: [] };

beforeEach(() => {
  vi.resetAllMocks();
  resetChainMemoForTests();
  delete process.env.BOARD_ARCHIVE_KEY;
});

describe("loadBoardResult", () => {
  it("returns the board when the store answers", async () => {
    mockGetRedis.mockReturnValue({ get: vi.fn().mockResolvedValue(board) } as never);
    await expect(loadBoardResult()).resolves.toEqual({ status: "ok", board });
  });

  // The distinction this whole type exists for: production has no file
  // fallback (content/board is gitignored), so a refused read used to reach the
  // page as "no board data yet — run /hh", blaming the routine for a quota.
  it("reports unavailable when the store throws and no file backs it up", async () => {
    mockGetRedis.mockReturnValue({ get: vi.fn().mockRejectedValue(new Error("max requests limit exceeded")) } as never);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    await expect(loadBoardResult()).resolves.toEqual({ status: "unavailable" });
  });

  it("reports empty when the store answers with nothing and no file backs it up", async () => {
    mockGetRedis.mockReturnValue({ get: vi.fn().mockResolvedValue(null) } as never);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    await expect(loadBoardResult()).resolves.toEqual({ status: "empty" });
  });

  it("still serves the local file when the store is down, which is how dev works", async () => {
    mockGetRedis.mockReturnValue({ get: vi.fn().mockRejectedValue(new Error("down")) } as never);
    mockReadFile.mockResolvedValue(JSON.stringify(board));
    await expect(loadBoardResult()).resolves.toEqual({ status: "ok", board });
  });
});

describe("loadBoard", () => {
  it("keeps its old null contract for the callers that only want the board", async () => {
    mockGetRedis.mockReturnValue({ get: vi.fn().mockRejectedValue(new Error("down")) } as never);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    await expect(loadBoard()).resolves.toBeNull();
  });
});

// ---- The chain, tried first (task four of the archive) ----
// The five tests above run with no archive key and must pass untouched: without
// the key the seams behave exactly as they did. These add the chain in front.
const TXID = "a".repeat(64);
const HEAD_TXID = "b".repeat(64);
const bytesOf = (doc: unknown) => new Uint8Array(Buffer.from(JSON.stringify(doc), "utf8"));
const headNaming = (surfaces: Record<string, string>) =>
  ({ status: "ok", headTxid: HEAD_TXID, head: { v: 1, surfaces } }) as const;
const liveCard = { id: "live", col: "todo" };
const doneCard = { id: "old", col: "done" };
/** The chain carries the board as its live half and its done ledger. */
const servingBothHalves = () =>
  mockReadFromHead.mockImplementation(async ({ surface }) => ({
    status: "ok",
    document: bytesOf(surface === "board-done" ? { cards: [doneCard] } : { ...board, cards: [liveCard] }),
    txid: TXID,
    headTxid: HEAD_TXID,
  }));

describe("the chain is asked first", () => {
  beforeEach(() => {
    process.env.BOARD_ARCHIVE_KEY = "2".repeat(64);
  });

  it("a board on the chain is reassembled from its two halves without the store being asked", async () => {
    mockResolveHead.mockResolvedValue(headNaming({ "board-latest": TXID, "board-done": TXID }));
    servingBothHalves();
    const get = vi.fn();
    mockGetRedis.mockReturnValue({ get } as never);
    await expect(loadBoardResult()).resolves.toEqual({ status: "ok", board: { ...board, cards: [liveCard, doneCard] } });
    expect(get).not.toHaveBeenCalled();
  });

  it("half a board is no board: a missing done ledger falls through to the store", async () => {
    mockResolveHead.mockResolvedValue(headNaming({ "board-latest": TXID }));
    mockReadFromHead.mockImplementation(async ({ surface }) =>
      surface === "board-latest"
        ? { status: "ok", document: bytesOf({ ...board, cards: [liveCard] }), txid: TXID, headTxid: HEAD_TXID }
        : { status: "missing", surface, headTxid: HEAD_TXID },
    );
    mockGetRedis.mockReturnValue({ get: vi.fn().mockResolvedValue(board) } as never);
    await expect(loadBoardResult()).resolves.toEqual({ status: "ok", board });
  });

  it("an unreachable chain falls through to the store — never an empty board", async () => {
    mockResolveHead.mockResolvedValue({ status: "unreachable", detail: "both indexers refused" });
    mockGetRedis.mockReturnValue({ get: vi.fn().mockResolvedValue(board) } as never);
    await expect(loadBoardResult()).resolves.toEqual({ status: "ok", board });
    expect(mockReadFromHead).not.toHaveBeenCalled();
  });

  it("a surface the head does not name falls through to the store", async () => {
    mockResolveHead.mockResolvedValue(headNaming({ "board-gardening": TXID }));
    mockReadFromHead.mockResolvedValue({ status: "missing", surface: "board-latest", headTxid: HEAD_TXID });
    mockGetRedis.mockReturnValue({ get: vi.fn().mockResolvedValue(board) } as never);
    await expect(loadBoardResult()).resolves.toEqual({ status: "ok", board });
  });

  it("the head is resolved once per window across every surface", async () => {
    mockResolveHead.mockResolvedValue(headNaming({ "board-latest": TXID, "board-done": TXID, "board-gardening": TXID }));
    mockReadFromHead.mockImplementation(async ({ surface }) => ({
      status: "ok",
      document: bytesOf(
        surface === "board-gardening" ? { updated: "now", jobs: [] }
          : surface === "board-done" ? { cards: [doneCard] }
          : { ...board, cards: [liveCard] },
      ),
      txid: TXID,
      headTxid: HEAD_TXID,
    }));
    await loadBoardResult();
    await loadGardening();
    await loadBoardResult();
    expect(mockResolveHead).toHaveBeenCalledTimes(1);
    expect(mockReadFromHead).toHaveBeenCalledTimes(3);
  });

  it("the report dates are read off the head", async () => {
    mockResolveHead.mockResolvedValue(
      headNaming({ "board-report-2026-09-01": TXID, "board-report-2026-08-31": TXID, "board-latest": TXID }),
    );
    await expect(listDates()).resolves.toEqual(["2026-09-01", "2026-08-31"]);
  });

  it("without an archive key the chain is never consulted", async () => {
    delete process.env.BOARD_ARCHIVE_KEY;
    mockGetRedis.mockReturnValue({ get: vi.fn().mockResolvedValue(board) } as never);
    await expect(loadBoardResult()).resolves.toEqual({ status: "ok", board });
    expect(mockResolveHead).not.toHaveBeenCalled();
  });
});
