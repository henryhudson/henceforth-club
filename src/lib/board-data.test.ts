import { describe, it, expect, vi, beforeEach } from "vitest";
import { promises as fs } from "fs";
import { getRedis } from "@/lib/redis";
import { loadBoard, loadBoardResult } from "./board-data";

vi.mock("@/lib/redis", () => ({ getRedis: vi.fn() }));
vi.mock("fs", () => ({ promises: { readFile: vi.fn(), readdir: vi.fn() } }));

const mockGetRedis = vi.mocked(getRedis);
const mockReadFile = vi.mocked(fs.readFile);

const board = { generated: "now", cards: [] };

beforeEach(() => {
  vi.resetAllMocks();
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
