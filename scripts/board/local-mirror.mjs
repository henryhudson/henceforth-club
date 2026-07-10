// Mirrors the current week's planner next to morning-board-data.js so the
// local Morning Board page (opened over file://) can script-tag it —
// browsers refuse file-to-file fetch, so the mirror is written at publish
// time instead. On machines without the viewer checkout (Vercel, the
// mini), this is a silent no-op.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const VIEWER_DIR =
  "/Users/henryhudson/Programming/Main/DaDeckOfCards/docs/superpowers/plans";

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
