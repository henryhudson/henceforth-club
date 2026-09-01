// The live week sits on the board. This writes the plan onto latest.json and
// morning-board-data.js so one artifact is the ledger. A derived
// morning-week-data.js is still written so an old local HTML tab keeps working.
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { weekSliceFromReport, withWeek } from "./week-plan.mjs";

const VIEWER_DIR =
  "/Users/henryhudson/Programming/Main/DaDeckOfCards/docs/superpowers/plans";

export function parseBoardJs(text) {
  const m = text.match(/window\.MORNING_BOARD\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!m) throw new Error("morning-board-data.js has no MORNING_BOARD");
  return JSON.parse(m[1]);
}

export function formatBoardJs(board) {
  return "window.MORNING_BOARD = " + JSON.stringify(board, null, 1) + ";\n";
}

/** Attach the live week to every board file we can see. Returns the slice. */
export async function attachWeekToBoardFiles(week, { root = process.cwd() } = {}) {
  const slice = weekSliceFromReport(week);
  const latestPath = path.join(root, "content/board/latest.json");
  if (existsSync(latestPath)) {
    const board = JSON.parse(await readFile(latestPath, "utf8"));
    await writeFile(latestPath, JSON.stringify(withWeek(board, slice), null, 2) + "\n");
  }
  const jsPath = path.join(VIEWER_DIR, "morning-board-data.js");
  if (existsSync(jsPath)) {
    const board = parseBoardJs(await readFile(jsPath, "utf8"));
    await writeFile(jsPath, formatBoardJs(withWeek(board, slice)));
  }
  await mirrorWeekToBoardViewer(week);
  return slice;
}

export async function writeBoardFiles(board, { root = process.cwd() } = {}) {
  const latestPath = path.join(root, "content/board/latest.json");
  if (existsSync(path.dirname(latestPath))) {
    await writeFile(latestPath, JSON.stringify(board, null, 2) + "\n");
  }
  const jsPath = path.join(VIEWER_DIR, "morning-board-data.js");
  if (existsSync(jsPath)) {
    await writeFile(jsPath, formatBoardJs(board));
  }
  if (board.week) {
    await mirrorWeekToBoardViewer({
      weekOf: board.week.weekOf,
      weekEnd: board.week.weekOf,
      generatedAt: board.week.generatedAt,
      retro: { stateOfUnion: board.week.stateOfUnion, weekPlan: board.week.weekPlan },
    });
  }
}

export async function mirrorWeekToBoardViewer(week) {
  if (!existsSync(VIEWER_DIR)) return false;
  const payload = {
    weekOf: week.weekOf,
    weekEnd: week.weekEnd,
    generatedAt: week.generatedAt,
    stateOfUnion: week.retro?.stateOfUnion ?? "",
    weekPlan: week.retro?.weekPlan ?? [],
  };
  await writeFile(
    path.join(VIEWER_DIR, "morning-week-data.js"),
    "window.MORNING_WEEK = " + JSON.stringify(payload, null, 2) + ";\n",
  );
  return true;
}
