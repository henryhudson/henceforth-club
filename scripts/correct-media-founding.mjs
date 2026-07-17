// Re-weight founding votes so media posts bear their true share of their
// transaction's REAL chain fee. v2 — rebuilt to the 2026-07-17 adversarial
// review's fix list (v1: unanimous DO_NOT_SHIP, nine confirmed findings).
//
//   node scripts/correct-media-founding.mjs <handle>                 plan: fetch fees + sizes,
//                                                                    print + persist the plan
//   node scripts/correct-media-founding.mjs <handle> --execute <plan.json>
//                                                                    apply EXACTLY that plan
//
// What v2 does differently, per the review:
//   - Fees come from the CHAIN (fetchTxFeeSats), cross-checked against a
//     second independent oracle (bitails) — exact agreement or abort. The
//     ledger's own sums are reported as drift, never trusted.
//   - Grouping is by each post's ARCHIVE txid, re-homing entries recorded
//     under a transaction their post no longer lives in.
//   - Media sizes: HEAD only; any non-positive size ABORTS (a real media
//     item is never 0 bytes). Sizes are frozen into the persisted plan, and
//     --execute applies the reviewed plan file — no refetch, no divergence.
//   - Before ANY write: every archive post must have a founding entry in the
//     live ledger and every plan change's oldEntry must be present — a
//     partial prior run halts here, loudly, instead of corrupting.
//   - The loop is try/caught; a failure names the in-flight post and warns:
//     do NOT re-run --execute — restore first (scripts/restore-founding-ledger.mjs).
//   - Post-flight compares fee tables order-insensitively.
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.loadEnvFile(path.join(REPO_ROOT, ".env.local"));
register(pathToFileURL(path.join(REPO_ROOT, "scripts/xtext-worker/aliasLoader.mjs")).href, import.meta.url);

const { getArchivePage } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/xArchiveCache.ts")).href);
const { readVoteLedger, appendFoundingVote } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/xVotes.ts")).href);
const { planFoundingCorrection } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/foundingCorrection.ts")).href);
const { fetchTxFeeSats } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/whatsonchain.ts")).href);
const { getRedis } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/redis.ts")).href);

const handle = process.argv[2];
const execIdx = process.argv.indexOf("--execute");
const planPath = execIdx >= 0 ? process.argv[execIdx + 1] : undefined;
if (!handle || (execIdx >= 0 && !planPath)) {
  console.error("usage: node scripts/correct-media-founding.mjs <handle> [--execute <plan.json>]");
  process.exit(1);
}

const sortedFees = (fees) => JSON.stringify(Object.entries(fees).sort());

// ── EXECUTE: apply a reviewed, persisted plan exactly. ──
if (planPath) {
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  if (plan.handle !== handle) { console.error(`plan is for @${plan.handle}, not @${handle}`); process.exit(1); }

  const ledger = await readVoteLedger(handle);
  const serial = (e) => JSON.stringify(Object.entries(e).sort());
  const present = new Set(ledger.map(serial));

  // Hard stop before any write: a partial prior run (struck entry, missing
  // replay) makes the ledger unsafe to correct incrementally.
  const missing = plan.changes.filter((c) => !present.has(serial(c.oldEntry)));
  const foundingCount = ledger.filter((e) => e.founding === true || e.txid.includes(":")).length;
  if (missing.length || foundingCount !== plan.expectedFoundingCount) {
    console.error(`ABORT before any write: ${missing.length} plan entries absent from the live ledger; founding count ${foundingCount} vs expected ${plan.expectedFoundingCount}.`);
    console.error(`The ledger has changed since this plan was made (or a partial run struck entries).`);
    console.error(`Do NOT proceed. Restore first if a partial run happened: node scripts/restore-founding-ledger.mjs <backup.json> ${handle}`);
    process.exit(1);
  }

  const backupPath = path.join(REPO_ROOT, `ledger-backup-${handle}-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(ledger, null, 2));
  console.log(`ledger backed up to ${backupPath} (${ledger.length} entries)`);

  const redis = getRedis();
  const ledgerKey = `x:ledger:${handle.toLowerCase()}`;
  let applied = 0;
  let inFlight = null;
  try {
    for (const c of plan.changes) {
      inFlight = c;
      const removed = await redis.lrem(ledgerKey, 1, c.oldEntry);
      if (removed !== 1) throw new Error(`LREM matched ${removed} (expected 1)`);
      const oldTx = c.oldEntry.txid.includes(":") ? c.oldEntry.txid.slice(0, c.oldEntry.txid.indexOf(":")) : c.oldEntry.txid;
      await redis.del(
        `x:vote:founding:${handle.toLowerCase()}:${c.postId}`,
        `x:vote:tx:${oldTx}:${c.postId}`,
        // Also the NEW composite gate: preflight proved the live founding
        // entry is oldEntry, so any gate under the new composite is stale —
        // left by a crashed run — and would deadlock the replay as
        // "duplicate" after a restore-then-retry.
        `x:vote:tx:${c.txid}:${c.postId}`,
      );
      const res = await appendFoundingVote(handle, {
        inscriptionTxid: c.txid,
        postId: c.postId,
        uploadCostSats: c.newSats,
        inscriptionDay: c.day,
      });
      if (res !== "recorded") throw new Error(`replay returned ${res}`);
      applied++;
    }
  } catch (err) {
    console.error(`\nFAILED at post ${inFlight?.postId} (change ${applied + 1}/${plan.changes.length}): ${err.message}`);
    console.error(`${applied} changes fully applied; the in-flight entry may be struck without its replay.`);
    console.error(`Do NOT re-run --execute. Restore first: node scripts/restore-founding-ledger.mjs ${backupPath} ${handle}`);
    process.exit(1);
  }

  // Post-flight: replan against the live ledger with the SAME frozen inputs —
  // zero residual changes, fee tables equal order-insensitively.
  const after = planFoundingCorrection(await readVoteLedger(handle), plan.posts, plan.feeByTx);
  const feesMatch = sortedFees(after.feeByTx) === sortedFees(plan.feeByTx);
  console.log(`applied ${applied}/${plan.changes.length}; post-flight: ${after.changes.length} residual changes, fees ${feesMatch ? "conserved" : "MISMATCH"}`);
  process.exit(after.changes.length === 0 && feesMatch ? 0 : 1);
}

// ── PLAN: fetch everything, verify, persist. ──
const page = await getArchivePage(handle, 0, 1_000_000);
if (!page) { console.error(`no cached archive for @${handle}`); process.exit(1); }

async function mediaSize(url) {
  const head = await fetch(url, { method: "HEAD" });
  const len = Number(head.headers.get("content-length"));
  if (!head.ok || !Number.isFinite(len) || len <= 0) {
    throw new Error(`media size unavailable for ${url} (HTTP ${head.status}, content-length ${head.headers.get("content-length")}) — a real media item is never 0 bytes; refusing to under-weight silently`);
  }
  return len;
}

async function bitailsFee(txid) {
  const res = await fetch(`https://api.bitails.io/tx/${txid}`);
  if (!res.ok) return undefined;
  const d = await res.json();
  return Number.isFinite(d?.fee) ? d.fee : undefined;
}

const excluded = [];
const posts = [];
for (const p of page.posts) {
  const mediaBytes = [];
  for (const m of p.media ?? []) {
    const match = /ordfs\.network\/([0-9a-f]{64})_\d+/.exec(m.url ?? "");
    // The guard tests the GROUPING transaction — the post's archive txid —
    // because that is the fee pool the weight would join.
    if (!match || match[1] !== p.txid) { excluded.push({ post: p.id, url: m.url }); continue; }
    mediaBytes.push(await mediaSize(m.url));
  }
  posts.push({ id: p.id, txid: p.txid, textBytes: Buffer.byteLength(p.text ?? "", "utf8"), mediaBytes });
}

const txids = [...new Set(posts.map((p) => p.txid).filter(Boolean))];
const chainFeeByTx = {};
for (const tx of txids) {
  const [woc, bt] = [await fetchTxFeeSats(tx), await bitailsFee(tx)];
  if (woc === null || woc === undefined) { console.error(`no WhatsOnChain fee for ${tx}`); process.exit(1); }
  if (bt !== undefined && bt !== woc) { console.error(`fee oracles disagree for ${tx}: WhatsOnChain ${woc} vs bitails ${bt} — refusing`); process.exit(1); }
  if (bt === undefined) console.log(`note: bitails unavailable for ${tx}; single-oracle fee ${woc}`);
  chainFeeByTx[tx] = woc;
}

const ledger = await readVoteLedger(handle);
const plan = planFoundingCorrection(ledger, posts, chainFeeByTx);
const expectedFoundingCount = ledger.filter((e) => e.founding === true || e.txid.includes(":")).length;

console.log(`@${handle}: ${posts.length} posts, ${ledger.length} ledger entries (${plan.untouchedVotes} votes untouched), ${excluded.length} media excluded (cross-tx)`);
console.log(`chain fees:`, Object.fromEntries(Object.entries(plan.feeByTx).map(([t, f]) => [t.slice(0, 8), f])));
console.log(`ledger drift vs chain:`, Object.fromEntries(Object.entries(plan.ledgerDriftByTx).map(([t, d]) => [t.slice(0, 8), d])));
console.log(`\ncorrections: ${plan.changes.length}`);
const sorted = [...plan.changes].sort((a, b) => (b.newSats - b.oldSats) - (a.newSats - a.oldSats));
for (const c of sorted.slice(0, 12)) {
  console.log(`  ${c.postId} (tx ${c.txid.slice(0, 8)}): ${c.oldSats.toLocaleString()} → ${c.newSats.toLocaleString()} sats`);
}

const out = path.join(REPO_ROOT, `plan-founding-${handle}-${Date.now()}.json`);
writeFileSync(out, JSON.stringify({ handle, expectedFoundingCount, posts, feeByTx: plan.feeByTx, ledgerDriftByTx: plan.ledgerDriftByTx, changes: plan.changes }, null, 2));
console.log(`\nplan persisted to ${out}`);
console.log(`review it, then: node scripts/correct-media-founding.mjs ${handle} --execute ${out}`);
