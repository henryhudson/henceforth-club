// Called by /hh each morning: patch today's major events (and done-marks) into
// the board's live week, then republish — no redeploy. The board is the ledger;
// the weekly newspaper is a snapshot, not a second planner.
// Usage: node --env-file=.env.local scripts/board/hh-plan-update.mjs <today> '{"events":[...],"done":[...]}'

import { Redis } from "@upstash/redis";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { weekOfFor, weekSliceFromReport, withWeek, patchBoardWeek } from "./week-plan.mjs";
import { WEEKDAYS } from "./whh-aggregate.mjs";
import { writeBoardFiles } from "./local-mirror.mjs";
import { pickBoard, persistBoard } from "./hh-plan-update-core.mjs";

const today = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const payload = JSON.parse(process.argv[3] ?? "{}");
const events = payload.events ?? [];
const done = payload.done ?? [];
const roll = payload.roll === true;
const weekday = WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()];

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const ROOT = process.cwd();
const LATEST = path.join(ROOT, "content/board/latest.json");
const WEEKS = path.join(ROOT, "content/board/weeks");

async function loadBoard() {
  let fromStore = null;
  let fromFile = null;
  try {
    if (redis) fromStore = await redis.get("board:latest");
  } catch { /* cap or transport — files still serve */ }
  try {
    fromFile = JSON.parse(await readFile(LATEST, "utf8"));
  } catch { /* no local file yet */ }
  return pickBoard(fromStore, fromFile);
}

async function migrateWeekOnto(board) {
  try {
    const files = (await readdir(WEEKS)).filter((f) => f.endsWith(".json")).sort().reverse();
    for (const f of files) {
      const week = JSON.parse(await readFile(path.join(WEEKS, f), "utf8"));
      const slice = weekSliceFromReport(week);
      if (slice.weekOf === weekOfFor(today) && slice.weekPlan.length) {
        return withWeek(board, slice);
      }
    }
  } catch { /* no weeks on disk */ }
  return board;
}

let board = await loadBoard();
if (!board) { console.error("no board to update — run /hh first"); process.exit(1); }
if (!board.week?.weekPlan?.length) board = await migrateWeekOnto(board);
if (!board.week?.weekPlan?.length) {
  console.error("no week on the board — run /whh first");
  process.exit(1);
}

const planWeekOf = board.week.weekOf || board.week.weekPlan[0]?.date;
if (planWeekOf !== weekOfFor(today)) {
  console.error(`board week (week of ${planWeekOf}) is not the current week (of ${weekOfFor(today)}) — run /whh for this week first`);
  process.exit(1);
}

// markEventDone matches the EXACT label — a fragment marks nothing.
const afterEvents = events.length
  ? patchBoardWeek(board, { weekday, events })
  : roll
    ? patchBoardWeek(board, { weekday, roll: true })
    : board;
const dayLabels = new Set(
  (afterEvents.week.weekPlan.find((d) => d.weekday === weekday)?.tasks ?? [])
    .map((t) => (typeof t === "string" ? t : t.label)),
);
const missed = done.filter((label) => !dayLabels.has(label));
if (missed.length) {
  console.error(`no task matched ${missed.length} done label(s) on ${weekday} — labels must be EXACT:\n  ${missed.join("\n  ")}`);
  process.exit(1);
}
board = patchBoardWeek(afterEvents, { weekday, done });

try {
  await persistBoard(board, {
    redis,
    writeFiles: (next) => writeBoardFiles(next, { root: ROOT }),
  });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
console.log(`updated ${weekday} on the board week — ${roll && !events.length ? "rolled forward, " : ""}${events.length} event(s) set, ${done.length} marked done`);
