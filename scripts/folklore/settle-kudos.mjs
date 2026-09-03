// The once-a-day kudos settle (plan task A9): what the site owes each bound
// handle, printed. DRY BY DEFAULT — this reads the store, prices every
// accrual at the live rate, prints the batch and exits 0. It broadcasts
// nothing and marks nothing settled. Version one is the dry run
// specification §9 asks for before the flag flips.
//
// usage:
//   node --env-file=.env.local scripts/folklore/settle-kudos.mjs
//
// SETTLE_BROADCAST=1 is reserved for the paying run and is NOT implemented
// here: the settlement purse — which key pays, funded from where — is not
// specified yet, and a payer with an unspecified key is exactly the thing
// this script must never improvise. Set, it refuses and exits 2, so a
// scheduled run can never pay by accident. markSettled (src/lib/kudos/
// float.ts) is the only way an accrual moves and is called only after an
// accepted broadcast, so today it is never called at all. No launchd job in
// version one; the retired club.henceforth.xtext-worker stays retired.
//
// Reads are SCAN, never KEYS: a full-keyspace KEYS burned the key-value
// store's monthly quota in August (docs/daily-review-corrections.md).

import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Redis } from "@upstash/redis";
import { EARNED_PREFIX, formatBatch, handleFromEarnedKey, planSettlement } from "./settle-kudos-core.mjs";

// The same bridge seed-folklore-board.mjs uses to import TypeScript from
// src/ in plain Node: the tuning constants and the live rate come from the
// site's own modules, so this script can never disagree with the site about
// what a kudos is worth.
const HERE = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(HERE, "../xtext-worker/aliasLoader.mjs")).href, import.meta.url);

const { KUDOS_PENCE, SETTLE_DUST_SATS } = await import("@/lib/kudos/constants");
const { gbpPerBsv } = await import("@/lib/xPrice");

if (process.env.SETTLE_BROADCAST === "1") {
  console.error(
    "settle-kudos: SETTLE_BROADCAST=1 is not implemented — no settlement purse is specified. Refusing rather than improvising a payer. Run without it for the dry run.",
  );
  process.exit(2);
}

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("settle-kudos: missing KV_REST_API_URL / KV_REST_API_TOKEN — nothing read.");
  process.exit(1);
}
const redis = new Redis({ url, token });

async function scanAllKeys(match) {
  const keys = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, { match, count: 200 });
    keys.push(...batch);
    cursor = String(next);
  } while (cursor !== "0");
  return keys;
}

const rate = await gbpPerBsv();
if (rate === undefined) {
  console.error("settle-kudos: no live rate, so nothing can be priced honestly — try again later.");
  process.exit(1);
}

const rows = [];
for (const key of await scanAllKeys(`${EARNED_PREFIX}*`)) {
  const handle = handleFromEarnedKey(key);
  if (!handle) continue;
  const earned = Number(await redis.get(key)) || 0;
  // The bound address lives on the owner record (src/lib/xOwner.ts); an
  // unbound handle has none, and the plan skips it without touching the
  // accrual.
  const owner = await redis.get(`x:owner:${handle}`);
  const address = owner && typeof owner.address === "string" ? owner.address : null;
  rows.push({ handle, earned, address });
}

const plan = planSettlement(rows, {
  gbpPerBsv: rate,
  kudosPence: KUDOS_PENCE,
  dustSats: SETTLE_DUST_SATS,
});
console.log(
  `settle-kudos dry run · ${new Date().toISOString()} · £${rate.toFixed(2)} per coin · ${rows.length} handle(s) with an accrual · nothing is paid, nothing is marked settled`,
);
for (const line of formatBatch(plan)) console.log(line);
