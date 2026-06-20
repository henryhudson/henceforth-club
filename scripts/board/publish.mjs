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
//   board:latest          -> the board JSON ({ generated, cards })
//   board:report:<date>   -> one day's report JSON
//   board:report:dates    -> a set of report dates (for the archive list)

import { Redis } from "@upstash/redis";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

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

// Board
try {
  const board = JSON.parse(
    await readFile(path.join(root, "content/board/latest.json"), "utf8"),
  );
  await redis.set("board:latest", board);
  console.log(`published board:latest (${board.cards?.length ?? 0} cards)`);
} catch (e) {
  console.error("no content/board/latest.json to publish:", e.message);
}

// Reports
try {
  const dir = path.join(root, "content/board/reports");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const date = f.replace(/\.json$/, "");
    const report = JSON.parse(await readFile(path.join(dir, f), "utf8"));
    await redis.set(`board:report:${date}`, report);
    await redis.sadd("board:report:dates", date);
    console.log(`published board:report:${date}`);
  }
} catch (e) {
  console.error("no reports to publish:", e.message);
}

console.log("done");
