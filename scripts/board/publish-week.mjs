// Publish the weekly review artifacts to Upstash. Mirrors scripts/board/publish.mjs,
// including its failure policy (publish-core.mjs): never describe a failure as
// something it is not, and a run that did not reach the store exits non-zero.
// The old version printed each refusal and then "done", exit 0 — observed live
// on 2026-08-30, when every week write was refused and the run still reported
// success. Run with: node --env-file=.env.local scripts/board/publish-week.mjs

import { Redis } from "@upstash/redis";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { STORE_REFUSED, classifyReadError, reasonFor, summarise } from "./publish-core.mjs";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) { console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN"); process.exit(1); }

const redis = new Redis({ url, token });
const dir = path.join(process.cwd(), "content/board/weeks");

const steps = [];
const ok = (name) => steps.push({ name, failed: false });
const failed = (name, kind, message) => steps.push({ name, failed: true, reason: reasonFor(kind, message) });

let files = [];
try {
  files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
} catch (e) {
  console.error("no weeks to publish:", e.message);
  process.exit(0);
}
for (const f of files) {
  const date = f.replace(/\.json$/, "");
  let week;
  try {
    week = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  } catch (e) {
    failed(`board:week:${date}`, classifyReadError(e), e.message);
    continue;
  }
  try {
    await redis.set(`board:week:${date}`, week);
    await redis.sadd("board:weeks", date);
    console.log(`published board:week:${date}`);
    ok(`board:week:${date}`);
  } catch (e) {
    failed(`board:week:${date}`, STORE_REFUSED, e.message);
  }
}

const { exitCode, lines } = summarise(steps);
for (const line of lines) (exitCode === 0 ? console.log : console.error)(line);
process.exit(exitCode);
