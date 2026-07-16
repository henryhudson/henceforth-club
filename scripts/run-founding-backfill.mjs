// Record upload costs for any archived posts that lack a founding vote.
//
//   node scripts/run-founding-backfill.mjs <handle>
//
// Run after any inscription lands (the 2026-07-15 delta shipped without
// this, and its posts ranked as if they cost nothing). Idempotent by
// construction: appendFoundingVote's per-post gate refuses posts that
// already carry a founding entry, so re-running is always safe. Fees come
// from WhatsOnChain with prevout resolution (fetchTxFeeSats) and split
// across a transaction's posts by text byte weight — for a text-only delta
// transaction that is each post's true share.
//
// Writes to the production vote ledger. Money path: run deliberately.
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.loadEnvFile(path.join(REPO_ROOT, ".env.local"));
register(pathToFileURL(path.join(REPO_ROOT, "scripts/xtext-worker/aliasLoader.mjs")).href, import.meta.url);

const { getArchivePage } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/xArchiveCache.ts")).href);
const { backfillFoundingVotes } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/foundingBackfill.ts")).href);

const handle = process.argv[2];
if (!handle) {
  console.error("usage: node scripts/run-founding-backfill.mjs <handle>");
  process.exit(1);
}

const page = await getArchivePage(handle, 0, 1_000_000);
if (!page) {
  console.error(`no cached archive for @${handle}`);
  process.exit(1);
}

const posts = page.posts.map((p) => ({
  id: p.id,
  txid: p.txid,
  weight: Buffer.byteLength(p.text ?? "", "utf8"),
}));
console.log(`@${handle}: ${posts.length} posts across ${new Set(posts.map((p) => p.txid)).size} transactions`);

const result = await backfillFoundingVotes(handle, posts, page.txTimes);
console.log(result);
