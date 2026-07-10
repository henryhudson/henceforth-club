// One-time backfill: read every legacy per-handle x:<handle> key and record it
// in x:handles (task 2, the /text directory) so handles registered before
// `stampHandle` existed still show up there.
//
// Per-handle keys are bare x:<handle>, but several other key families share
// the x: prefix — x:job:*, x:score:*, x:vote:*, x:ledger:*, x:owner:*,
// x:txdigest:*, and x:handles itself. Every one of those except x:handles
// carries a further colon, so the suffix shape alone rules them out; x:handles
// does not (`handles` is itself a well-formed handle shape), so a key only
// counts once its value has also been read and shown to actually be a txid
// list — the shape a per-handle key holds, never what x:handles (a sorted
// set) would give back.
//
// Run once against production, after Upstash creds are in .env.local:
//   node --env-file=.env.local scripts/backfill-text-directory.mjs

import { Redis } from "@upstash/redis";

const HANDLES_KEY = "x:handles";
const HANDLE_SUFFIX = /^[A-Za-z0-9_]{1,15}$/; // X's own handle-length limit
const TXID = /^[0-9a-fA-F]{64}$/;
const WOC = "https://api.whatsonchain.com/v1/bsv/main";

/** Pure: the handle a key names, if its suffix has a handle's shape — or
 * null. Suffix-only; a same-shaped impostor (x:handles) still needs the
 * value check in `isValidTxidList` below. */
export function handleFromKey(key) {
  if (!key.startsWith("x:")) return null;
  const suffix = key.slice(2);
  return HANDLE_SUFFIX.test(suffix) ? suffix : null;
}

/** Pure: true when a stored value has the shape a per-handle key actually
 * holds — one txid, or a non-empty list of them (oldest first). */
export function isValidTxidList(value) {
  if (typeof value === "string") return TXID.test(value);
  if (Array.isArray(value)) return value.length > 0 && value.every((v) => typeof v === "string" && TXID.test(v));
  return false;
}

/** Every genuine per-handle entry reachable from `redis`, scanning the whole
 * x:* namespace: handle-shaped suffix AND a value that parses as a txid
 * list. A key whose value can't be read as expected (x:handles is a sorted
 * set — GET on it throws WRONGTYPE) is skipped, not treated as empty. */
export async function scanCandidateHandles(redis) {
  const keys = await scanAllKeys(redis, "x:*");
  const candidates = [];
  for (const key of keys) {
    const handle = handleFromKey(key);
    if (!handle) continue;
    let value;
    try {
      value = await redis.get(key);
    } catch {
      continue;
    }
    if (!isValidTxidList(value)) continue;
    candidates.push({ handle, latestTxid: Array.isArray(value) ? value.at(-1) : value });
  }
  return candidates;
}

async function scanAllKeys(redis, match) {
  const keys = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, { match, count: 200 });
    keys.push(...batch);
    cursor = next;
  } while (cursor !== "0");
  return keys;
}

/** A transaction's confirmation time, in milliseconds — or null when it
 * can't be read (unconfirmed, or the lookup fails). Best-effort: a handle
 * whose time can't be read is skipped rather than backfilled with "now",
 * which would misrepresent it as freshly registered. */
async function fetchConfirmedTimeMs(txid, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${WOC}/tx/hash/${txid}`);
    if (!res.ok) return null;
    const body = await res.json();
    const time = body?.time ?? body?.blocktime;
    return typeof time === "number" ? time * 1000 : null;
  } catch {
    return null;
  }
}

async function run() {
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

  const candidates = await scanCandidateHandles(redis);
  console.log(`${candidates.length} handle(s) to backfill`);

  let stamped = 0;
  for (const { handle, latestTxid } of candidates) {
    const atMs = await fetchConfirmedTimeMs(latestTxid);
    if (atMs === null) {
      console.warn(`skipping ${handle} — could not read ${latestTxid}'s confirmed time`);
      continue;
    }
    await redis.zadd(HANDLES_KEY, { gt: true }, { score: atMs, member: handle.toLowerCase() });
    console.log(`stamped ${handle} at ${new Date(atMs).toISOString()}`);
    stamped++;
  }

  console.log(`done — stamped ${stamped}/${candidates.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
