// Backfill the editions into the publisher's ledger from the store's own index
// (board:pdftx:<kind>:<date>), so the next head names every back number ever
// inscribed. Costs nothing: the ledger is local, and the head that carries the
// entries is the next publish's head. Existing ledger entries are never
// overwritten — the chain is the truth and the ledger only remembers it.
//
// usage: node --env-file=.env.local scripts/board/chain-backfill-editions.mjs [--dry-run]

import path from "node:path";
import { Redis } from "@upstash/redis";
import { readLedger, writeLedger } from "./chain-publish.mjs";
import { backfillEntries } from "./chain-publish-core.mjs";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) { console.error("Upstash env missing — run with --env-file=.env.local"); process.exit(1); }
const dryRun = process.argv.includes("--dry-run");
const ledgerPath = path.join(process.cwd(), "content/board/.chain-ledger.json");

const redis = new Redis({ url, token });
// One KEYS call, not a scan per date: sixty-odd keys, once.
const keys = (await redis.keys("board:pdftx:*")).sort();
const txids = keys.length ? await redis.mget(...keys) : [];
const pairs = keys.map((key, i) => ({ key, txid: txids[i] }));

const ledger = await readLedger(ledgerPath);
const { ledger: next, added, skipped, invalid } = backfillEntries(ledger, pairs);
for (const s of added) console.log(`backfilled ${s}`);
for (const s of skipped) console.log(`kept ${s} (already in the ledger)`);
for (const k of invalid) console.warn(`ignored ${k}: not an edition key with a transaction id`);
if (!dryRun) await writeLedger(ledgerPath, next);
console.log(`${added.length} added, ${skipped.length} kept, ${invalid.length} ignored${dryRun ? " — dry run, ledger untouched" : ""}`);
