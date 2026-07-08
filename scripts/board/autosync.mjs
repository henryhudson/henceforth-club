// autosync.mjs — keep the LIVE website board (Upstash → /board) continuously in
// sync with the canonical Morning Board source. Watches morning-board-data.js;
// on any change it regenerates content/board/latest.json and runs publish.mjs.
//
// Debounced (coalesces mid-edit bursts) and VALIDATED (a broken/half-written
// board-data.js is skipped, never published). Designed to run forever under a
// launchd LaunchAgent (club.henceforth.board-autosync) so the website updates
// "at all times" without anyone running publish by hand.
//
//   node scripts/board/autosync.mjs            # run in foreground
//   launchctl load ~/Library/LaunchAgents/club.henceforth.board-autosync.plist
//
// Override the watched source with BOARD_DATA_PATH if the path ever moves.

import { watch } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BOARD_DATA =
  process.env.BOARD_DATA_PATH ||
  "/Users/henryhudson/Programming/Main/DaDeckOfCards/docs/superpowers/plans/morning-board-data.js";

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); // henceforth-club
const LATEST = path.join(ROOT, "content/board/latest.json");
const PUBLISH = path.join(ROOT, "scripts/board/publish.mjs");

const DEBOUNCE_MS = 800;

function log(msg) {
  console.log(`[board-autosync ${new Date().toISOString()}] ${msg}`);
}

// board-data.js is `window.MORNING_BOARD = {...}` (+ a non-rendered `log`).
// Evaluate it in a shim and lift {generated, cards} — exactly what the site
// and publish.mjs consume.
async function regenLatest() {
  const src = await readFile(BOARD_DATA, "utf8");
  const shim = {};
  new Function("window", src)(shim);
  const board = shim.MORNING_BOARD;
  if (!board || typeof board.generated !== "string" || !Array.isArray(board.cards)) {
    throw new Error("board-data.js did not yield { generated, cards } (mid-edit?)");
  }
  await writeFile(LATEST, JSON.stringify({ generated: board.generated, cards: board.cards }, null, 2) + "\n");
  return board.cards.length;
}

function runPublish() {
  return new Promise((resolve) => {
    // Reuse the very node binary running this watcher so launchd's bare PATH
    // doesn't matter; --env-file gives publish.mjs the Upstash creds.
    const p = spawn(process.execPath, ["--env-file=.env.local", PUBLISH], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out: out.trim() }));
    p.on("error", (e) => resolve({ code: -1, out: e.message }));
  });
}

let running = false;
let pending = false;
async function sync(reason) {
  if (running) { pending = true; return; }
  running = true;
  try {
    const n = await regenLatest();
    const { code, out } = await runPublish();
    const tail = out.split("\n").filter(Boolean).pop() || "";
    log(code === 0 ? `${reason}: synced ${n} cards → Upstash (${tail})` : `${reason}: publish FAILED (${code}) ${out}`);
  } catch (e) {
    log(`${reason}: skipped — ${e.message}`);
  } finally {
    running = false;
    if (pending) { pending = false; setTimeout(() => sync("coalesced"), 200); }
  }
}

let timer = null;
function schedule(reason) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => sync(reason), DEBOUNCE_MS);
}

const dir = path.dirname(BOARD_DATA);
const base = path.basename(BOARD_DATA);
log(`watching ${BOARD_DATA} → ${LATEST} → Upstash`);
await sync("startup"); // bring the website current immediately on launch
// Watch the DIRECTORY (robust to atomic rename/replace, which a single-file
// watch can miss) and filter to our file.
watch(dir, { persistent: true }, (_event, filename) => {
  if (filename === base) schedule("board-data.js changed");
});
