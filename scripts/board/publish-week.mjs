// Publish the weekly review artifacts to Upstash. Mirrors scripts/board/publish.mjs.
// Run with: node --env-file=.env.local scripts/board/publish-week.mjs

import { Redis } from "@upstash/redis";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) { console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN"); process.exit(1); }

const redis = new Redis({ url, token });
const dir = path.join(process.cwd(), "content/board/weeks");
let files = [];
try {
  files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
} catch (e) {
  console.error("no weeks to publish:", e.message);
  process.exit(0);
}
for (const f of files) {
  const date = f.replace(/\.json$/, "");
  try {
    const week = JSON.parse(await readFile(path.join(dir, f), "utf8"));
    await redis.set(`board:week:${date}`, week);
    await redis.sadd("board:weeks", date);
    console.log(`published board:week:${date}`);
  } catch (e) { console.error(f, e.message); }
}
console.log("done");
