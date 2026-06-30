// Called by /hh each morning: patch today's major events (and done-marks) into the current week's
// planner, then republish — no redeploy. Reads the latest published week (Upstash → file fallback).
// Usage: node --env-file=.env.local scripts/board/hh-plan-update.mjs <today> '{"events":[...],"done":[...]}'

import { Redis } from "@upstash/redis";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { weekOfFor, setDayEvents, markEventDone } from "./week-plan.mjs";
import { WEEKDAYS } from "./whh-aggregate.mjs";

const today = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const payload = JSON.parse(process.argv[3] ?? "{}");
const events = payload.events ?? [];
const done = payload.done ?? [];
const weekday = WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()];

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const DIR = path.join(process.cwd(), "content/board/weeks");

async function latestWeek() {
  if (redis) {
    const dates = await redis.smembers("board:weeks");
    if (dates?.length) {
      const date = [...dates].sort().reverse()[0];
      const week = await redis.get(`board:week:${date}`);
      if (week) return { date, week };
    }
  }
  try {
    const files = (await readdir(DIR)).filter((f) => f.endsWith(".json")).sort().reverse();
    if (files.length) {
      const date = files[0].replace(/\.json$/, "");
      return { date, week: JSON.parse(await readFile(path.join(DIR, files[0]), "utf8")) };
    }
  } catch { /* none on disk */ }
  return null;
}

const found = await latestWeek();
if (!found) { console.error("no week planner to update — run /whh first"); process.exit(1); }
const { date, week } = found;

// Don't patch a planner from a previous week — /whh must lay out the current week first.
const planWeekOf = week.retro?.weekPlan?.[0]?.date;
if (planWeekOf !== weekOfFor(today)) {
  console.error(`latest planner (week of ${planWeekOf}) is not the current week (of ${weekOfFor(today)}) — run /whh for this week first`);
  process.exit(1);
}

let plan = week.retro.weekPlan;
if (events.length) plan = setDayEvents(plan, weekday, events);
for (const label of done) plan = markEventDone(plan, weekday, label);
week.retro.weekPlan = plan;

await writeFile(path.join(DIR, `${date}.json`), JSON.stringify(week, null, 2) + "\n");
if (redis) { await redis.set(`board:week:${date}`, week); await redis.sadd("board:weeks", date); }
console.log(`updated ${weekday} on board:week:${date} — ${events.length} event(s), ${done.length} marked done`);
