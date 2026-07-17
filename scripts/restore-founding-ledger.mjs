// Restore a vote ledger from a correct-media-founding backup — the real
// restore path the 2026-07-17 review demanded (v1 said "restore from the
// backup" with no tool that could).
//
//   node scripts/restore-founding-ledger.mjs <backup.json> <handle>
//
// Deletes the ledger list, RPUSHes every backed-up entry in original order,
// and re-derives the gate keys from the entries themselves (founding gates
// from composite txids; the txid-counts-once gates for every entry). Safe to
// run repeatedly — it converges on the backup's exact state.
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.loadEnvFile(path.join(REPO_ROOT, ".env.local"));
register(pathToFileURL(path.join(REPO_ROOT, "scripts/xtext-worker/aliasLoader.mjs")).href, import.meta.url);
const { getRedis } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/redis.ts")).href);

const [backupPath, handle] = process.argv.slice(2);
if (!backupPath || !handle) {
  console.error("usage: node scripts/restore-founding-ledger.mjs <backup.json> <handle>");
  process.exit(1);
}

const entries = JSON.parse(readFileSync(backupPath, "utf8"));
if (!Array.isArray(entries) || entries.length === 0) {
  console.error("backup is empty or not an entry array — refusing");
  process.exit(1);
}

const redis = getRedis();
const lower = handle.toLowerCase();
const ledgerKey = `x:ledger:${lower}`;

// Collect the gate keys the restored entries imply. Founding entries carry
// the composite `<txid>:<postId>`; their founding gate stores the bare txid.
const gateSets = [];
for (const e of entries) {
  gateSets.push([`x:vote:tx:${e.txid}`, "1"]);
  if (e.founding === true || e.txid.includes(":")) {
    const tx = e.txid.slice(0, e.txid.indexOf(":"));
    gateSets.push([`x:vote:founding:${lower}:${e.postId}`, tx]);
  }
}

await redis.del(ledgerKey);
for (const e of entries) await redis.rpush(ledgerKey, e);
for (const [key, value] of gateSets) await redis.set(key, value);

const restored = await redis.lrange(ledgerKey, 0, -1);
console.log(`restored ${restored.length}/${entries.length} entries to ${ledgerKey}, ${gateSets.length} gate keys re-set`);
process.exit(restored.length === entries.length ? 0 : 1);
