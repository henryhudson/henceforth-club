// Publish the Morning Board + reports to Upstash, so the gated /board and
// /board/report pages serve live data in production (they read these keys,
// falling back to the local content files only in dev).
//
// Run by /hh after it writes content/board/latest.json + reports/<date>.json:
//   node --env-file=.env.local scripts/board/publish.mjs
// Needs Upstash creds in env (KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/
// TOKEN) — the same ones the site's api/hit + api/stats already use.
//
// Keys:
//   board:latest          -> the board JSON ({ generated, generatedAt, cards })
//   board:report:<date>   -> one day's report JSON
//   board:report:dates    -> a set of report dates (for the archive list)
//   board:gardening       -> the parsed gardening schedule (the Morning
//                            Edition's garden diary; source of truth is
//                            ~/Gardening/schedule.md on Henry's laptop, so
//                            this key refreshes on every laptop publish and
//                            is silently skipped elsewhere)
//
// FAILURE POLICY (2026-08-28). This script used to catch every error, print a
// message that named the wrong cause, and exit 0 regardless. On 24 August the
// store began refusing writes; the run printed "no content/board/latest.json to
// publish" about a file that was present, said "done", and exited clean. The
// board served four-day-old data for four days. Now: every step is recorded,
// the reason is stated accurately, and a run that did not reach the store exits
// non-zero. See publish-core.mjs.

import { Redis } from "@upstash/redis";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseGardeningSchedule } from "./gardening-core.mjs";
import { STORE_REFUSED, classifyReadError, reasonFor, summarise } from "./publish-core.mjs";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error(
    "Upstash creds not set (KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN). " +
      "Add them to henceforth-club/.env.local (e.g. `vercel env pull`).",
  );
  process.exit(1);
}

const redis = new Redis({ url, token });
const root = process.cwd();

/** Every step this run attempted, so the summary can be honest about all of them. */
const steps = [];
const ok = (name) => steps.push({ name, failed: false });
const failed = (name, kind, message) => steps.push({ name, failed: true, reason: reasonFor(kind, message) });

// Board. Reading the file and writing the store are separate failures with
// separate causes, so they are caught separately — conflating them is what
// produced four days of silence.
let board = null;
try {
  board = JSON.parse(await readFile(path.join(root, "content/board/latest.json"), "utf8"));
} catch (e) {
  failed("board:latest", classifyReadError(e), e.message);
}
if (board) {
  try {
    await redis.set("board:latest", board);
    ok("board:latest");
    console.log(`published board:latest (${board.cards?.length ?? 0} cards)`);
  } catch (e) {
    failed("board:latest", STORE_REFUSED, e.message);
  }
}

// Reports
let reportFiles = null;
const reportDir = path.join(root, "content/board/reports");
try {
  reportFiles = (await readdir(reportDir)).filter((f) => f.endsWith(".json"));
} catch (e) {
  failed("board:report:*", classifyReadError(e), e.message);
}
for (const f of reportFiles ?? []) {
  const date = f.replace(/\.json$/, "");
  let report = null;
  try {
    report = JSON.parse(await readFile(path.join(reportDir, f), "utf8"));
  } catch (e) {
    failed(`board:report:${date}`, classifyReadError(e), e.message);
    continue;
  }
  try {
    await redis.set(`board:report:${date}`, report);
    await redis.sadd("board:report:dates", date);
    ok(`board:report:${date}`);
    console.log(`published board:report:${date}`);
  } catch (e) {
    failed(`board:report:${date}`, STORE_REFUSED, e.message);
  }
}

// Gardening (Henry, 2026-08-20: the Morning Edition doubles as a calendar).
// Only a genuinely missing schedule is silent (the mini has none); any other
// failure warns, and a schedule parsing to zero rows is never published over
// the last good diary — format drift must not blank it quietly. A schedule that
// parsed fine but could not be WRITTEN is a store failure like any other, and
// now counts as one.
let jobs = null;
try {
  jobs = parseGardeningSchedule(await readFile(path.join(homedir(), "Gardening/schedule.md"), "utf8"));
} catch (e) {
  if (e?.code !== "ENOENT") {
    // Present but unreadable: warn, as before. Not a store failure.
    console.warn(`board:gardening NOT updated: ${e.message}`);
  }
}
if (jobs !== null) {
  if (jobs.length === 0) {
    console.warn(
      "board:gardening NOT updated: the schedule parsed to zero dated rows — the last published diary stands",
    );
  } else {
    try {
      await redis.set("board:gardening", { updated: new Date().toISOString(), jobs });
      ok("board:gardening");
      console.log(`published board:gardening (${jobs.length} dated rows)`);
    } catch (e) {
      failed("board:gardening", STORE_REFUSED, e.message);
    }
  }
}

const { exitCode, lines } = summarise(steps);
for (const line of lines) (exitCode === 0 ? console.log : console.error)(line);
process.exit(exitCode);
