import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBoardJs, formatBoardJs, writeBoardFiles } from "./local-mirror.mjs";
import { patchBoardWeek } from "./week-plan.mjs";

describe("board file codec", () => {
  it("round-trips a board that already carries a week", () => {
    const board = {
      generated: "2026-08-26 12:00",
      cards: [{ id: "c1", col: "todo" }],
      week: { weekOf: "2026-08-23", weekPlan: [{ date: "2026-08-26", weekday: "Wed", isReviewDay: true, tasks: [] }] },
    };
    const text = formatBoardJs(board);
    expect(text.startsWith("window.MORNING_BOARD = ")).toBe(true);
    expect(parseBoardJs(text)).toEqual(board);
  });
});

// Both real paths are kept out of reach: root and viewerDir point at a
// temporary folder here, and the test runner points the module's default
// viewer folder at one that does not exist (vitest.config.ts).
describe("writeBoardFiles — the planner owns the week and the dateline, nothing else", () => {
  const week = {
    weekOf: "2026-09-06",
    weekPlan: [{ date: "2026-09-07", weekday: "Mon", isReviewDay: true, tasks: ["Ship the follow-walk fix"] }],
  };
  const ledger = {
    generated: "2026-09-07 09:55 · Monday: the month and year plans seeded",
    generatedAt: "2026-09-07T08:55:00.000Z",
    cards: [{ id: "c1", col: "todo" }],
    week,
    month: { title: "September 2026", items: [{ when: "2026-09-09", label: "Ship day: Hansard 1.11." }] },
    year: { title: "The year from September 2026", items: [{ when: "2026-10", label: "The folklore door opens." }] },
  };
  // The store's copy was published before the plans were seeded on the file.
  const fromStore = { generated: "2026-09-07 08:08 · Monday", generatedAt: "2026-09-07T08:08:13.032Z", cards: ledger.cards, week };

  it("keeps a board file's month and year through a done write and an events write", async () => {
    const root = await mkdtemp(join(tmpdir(), "club-board-"));
    try {
      const viewerDir = join(root, "viewer");
      await mkdir(join(root, "content/board"), { recursive: true });
      await mkdir(viewerDir);
      const latestPath = join(root, "content/board/latest.json");
      const jsPath = join(viewerDir, "morning-board-data.js");
      await writeFile(latestPath, JSON.stringify(ledger, null, 2) + "\n");
      await writeFile(jsPath, formatBoardJs(ledger));

      const afterDone = patchBoardWeek(fromStore, { weekday: "Mon", done: ["Ship the follow-walk fix"] });
      await writeBoardFiles(afterDone, { root, viewerDir });
      const afterEvents = patchBoardWeek(afterDone, {
        weekday: "Mon",
        events: [{ label: "Ship the follow-walk fix", done: true }, "Then the release press"],
      });
      await writeBoardFiles(afterEvents, { root, viewerDir });

      const written = [JSON.parse(await readFile(latestPath, "utf8")), parseBoardJs(await readFile(jsPath, "utf8"))];
      for (const board of written) {
        expect(board.month).toEqual(ledger.month);
        expect(board.year).toEqual(ledger.year);
        expect(board.cards).toEqual(ledger.cards);
        expect(board.week).toEqual(afterEvents.week);
        expect(board.generated).toBe(fromStore.generated);
        expect(board.generatedAt).toBe(fromStore.generatedAt);
      }
      expect(existsSync(join(viewerDir, "morning-week-data.js"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes the whole board where no file stands yet", async () => {
    const root = await mkdtemp(join(tmpdir(), "club-board-"));
    try {
      await mkdir(join(root, "content/board"), { recursive: true });
      await writeBoardFiles(fromStore, { root, viewerDir: join(root, "no-viewer") });
      expect(JSON.parse(await readFile(join(root, "content/board/latest.json"), "utf8"))).toEqual(fromStore);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
