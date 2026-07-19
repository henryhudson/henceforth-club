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
// Run against production only after the feed (task A4) is deployed:
//   node --env-file=.env.local scripts/seed-folklore-board.mjs

import { Redis } from "@upstash/redis";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN");
  process.exit(1);
}
const redis = new Redis({ url, token });

const HANDLES_KEY = "x:handles";
const BOARD_KEY = "folklore:board";
const profileMember = (handle) => `profile:${handle.toLowerCase()}`;

const handles = await redis.zrange(HANDLES_KEY, 0, -1);
if (!Array.isArray(handles) || handles.length === 0) {
  console.log("no handles in the directory; nothing to seed");
  process.exit(0);
}

let seeded = 0;
for (const handle of handles) {
  const added = await redis.zadd(
    BOARD_KEY,
    { nx: true },
    { score: 0, member: profileMember(String(handle)) },
  );
  if (added) seeded += 1;
}
console.log(`board seeded: ${seeded} new profile cards of ${handles.length} handles (nx — existing scores untouched)`);
