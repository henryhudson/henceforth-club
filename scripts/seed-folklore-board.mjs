// Seed the folklore board with one profile card per directory handle.
//
// Idempotent by construction: every write is `zadd nx`, so a handle already
// on the board — including one whose kudos have since moved its score —
// is left exactly as it stands. Safe to re-run any time; running it twice
// is the test.
//
// Profiles seed at score zero. The per-handle kudos total is not a
// first-class number today (the directory ranks by author Elo, and tip
// counts are per-post), so the board's profile totals accrue from the
// kudos wiring onward rather than being back-computed from a rollup that
// does not exist. A deliberate narrow reading of plan task A8, recorded
// here so the adversarial review can object.
//
// Zero is the profile floor and links enter half a kudos above it
// (LINK_SCORE_OFFSET) so that a freshly-paid link is never buried under the
// whole directory by the zset's equal-score member tie-break. That number
// lives in src/lib/folkloreBoard.ts and nowhere else — which is why this
// script imports seedProfileOnBoard rather than re-deriving the board key
// and the member encoding: one formula for the member encoding, per that
// module's own doctrine.
//
// Run against production only after the feed (task A4) is deployed:
//   node --env-file=.env.local scripts/seed-folklore-board.mjs

import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Redis } from "@upstash/redis";

// The same bridge run.mjs uses to import TypeScript from src/ in plain Node:
// it resolves the "@/" alias and extensionless relative specifiers, then
// hands back to Node's own TypeScript support. See aliasLoader.mjs's header.
const HERE = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(HERE, "xtext-worker/aliasLoader.mjs")).href, import.meta.url);

const { seedProfileOnBoard } = await import("@/lib/folkloreBoard");

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN");
  process.exit(1);
}
const redis = new Redis({ url, token });

const HANDLES_KEY = "x:handles";

const handles = await redis.zrange(HANDLES_KEY, 0, -1);
if (!Array.isArray(handles) || handles.length === 0) {
  console.log("no handles in the directory; nothing to seed");
  process.exit(0);
}

let seeded = 0;
for (const handle of handles) {
  if (await seedProfileOnBoard(String(handle), 0, redis)) seeded += 1;
}
console.log(`board seeded: ${seeded} new profile cards of ${handles.length} handles (nx — existing scores untouched)`);
