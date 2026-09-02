import { describe, it, expect } from "vitest";
import { pickBoard, persistBoard } from "./hh-plan-update-core.mjs";

const older = { generatedAt: "2026-08-27T09:00:00.000Z", cards: [{ id: "stale" }] };
const newer = { generatedAt: "2026-09-01T22:16:00.000Z", cards: [{ id: "fresh" }] };

describe("pickBoard — the store is not trusted just because it answered", () => {
  it("takes the file when it is newer than the store", () => {
    expect(pickBoard(older, newer)).toBe(newer);
  });

  it("takes the store when it is newer than the file", () => {
    expect(pickBoard(newer, older)).toBe(newer);
  });

  it("falls back to whichever side exists", () => {
    expect(pickBoard(older, null)).toBe(older);
    expect(pickBoard(null, newer)).toBe(newer);
    expect(pickBoard(null, null)).toBe(null);
  });

  it("ties on generatedAt go to the store, matching the previous default", () => {
    const a = { generatedAt: "2026-09-01T12:00:00.000Z", cards: [1] };
    const b = { generatedAt: "2026-09-01T12:00:00.000Z", cards: [2] };
    expect(pickBoard(a, b)).toBe(a);
  });
});

describe("persistBoard — store first, files only after it lands", () => {
  it("writes the store then the files, in that order", async () => {
    const order = [];
    const redis = { set: async () => { order.push("store"); } };
    await persistBoard({ cards: [] }, {
      redis,
      writeFiles: async () => { order.push("files"); },
    });
    expect(order).toEqual(["store", "files"]);
  });

  it("does not touch local files when the store refuses, and the error does not claim they were updated", async () => {
    let filesWritten = false;
    const redis = { set: async () => { throw new Error("ERR max requests limit exceeded"); } };
    await expect(persistBoard({ cards: [] }, {
      redis,
      writeFiles: async () => { filesWritten = true; },
    })).rejects.toThrow(/local files not updated/);
    expect(filesWritten).toBe(false);
  });

  it("with no redis, writes files and does not pretend a store write happened", async () => {
    const order = [];
    await persistBoard({ cards: [] }, {
      redis: null,
      writeFiles: async () => { order.push("files"); },
    });
    expect(order).toEqual(["files"]);
  });
});
