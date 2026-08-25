// The production entry — the only file launchd ever runs. It wires
// worker.mjs's runWorkerTick with every real dependency: the Upstash-backed
// job store (src/lib/folkloreJob/jobStore.ts, imported through the alias-loader
// bridge below), live network fetch, the Keychain wrapping key, and the
// worker's own tuning constants — then ticks every fifteen seconds. Runs on
// the Mac mini only, launched by club.henceforth.xtext-worker.plist.
//
// Everything that decides WHAT to do each tick lives in worker.mjs, tested
// there against a fake store and a stubbed fetch. This file only supplies
// the real things.

import { existsSync } from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { wrapKeyProbeError, wrappingKeyFromKeychain } from "./keystore.mjs";
import { FEE_PER_KB, REVENUE_ADDRESS, floatPoolAddressError, revenueAddressError, runWorkerTick } from "./worker.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const TICK_MS = 15_000;

// .env.local carries the Upstash credentials (KV_REST_API_URL/TOKEN) and,
// optionally, XTEXT_TAAL_API_KEY — the same file `vercel env pull` produces
// for local development. A launchd job has none of a login shell's
// environment, so this is the only place those variables get loaded.
const envFile = path.join(REPO_ROOT, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Hard rule 1, checked before anything else touches the network or a key:
// the exact guard task 8 built, reused rather than re-implemented.
const startupError = revenueAddressError(REVENUE_ADDRESS);
if (startupError) {
  console.error(`xtext-worker refusing to start: ${startupError}`);
  console.error("Set REVENUE_ADDRESS in scripts/xtext-worker/worker.mjs (a task-10 gate item).");
  process.exit(1);
}

// The £2 kudos float leg's destination, read here (after .env.local loads —
// a module-level constant in worker.mjs would evaluate before the file is
// loaded). Unset is allowed: only kudos-float jobs need it, and each such job
// refuses per tick and refunds until it is set. Set-but-invalid refuses to
// start, exactly like the revenue address — a configured lie is worse than a
// gap.
const FLOAT_POOL_ADDRESS = process.env.XTEXT_FLOAT_POOL_ADDRESS ?? "";
const floatPoolError = floatPoolAddressError(FLOAT_POOL_ADDRESS);
if (FLOAT_POOL_ADDRESS.length > 0 && floatPoolError) {
  console.error(`xtext-worker refusing to start: ${floatPoolError}`);
  process.exit(1);
}
if (floatPoolError) {
  console.warn(`xtext-worker: ${floatPoolError} — until then a job carrying a kudos float leg refuses to inscribe and refunds itself.`);
}

const jobsDir = path.join(HERE, "jobs");

let wrapKey;
try {
  wrapKey = wrappingKeyFromKeychain();
} catch (err) {
  console.error("xtext-worker refusing to start: could not read the Keychain wrapping key.", err.message);
  console.error("If NO wrapped custody keys exist yet (scripts/xtext-worker/jobs/ is empty), seed one:");
  console.error("  security add-generic-password -s xtext-worker-wrap -w <32 random bytes hex>");
  console.error(
    "If wrapped custody keys EXIST there, do NOT seed a fresh key — a new key cannot open them and every fund-linked key would be stranded. Restore the original wrapping key from backup.",
  );
  process.exit(1);
}

// The lifecycle probe (money-path review F2, 2026-08-09): a wrapping key that
// reads fine but is not the key that wrapped the custody keys already on disk
// would silently read every fund-linked key as absent. Refuse to run instead.
const probeError = wrapKeyProbeError(wrapKey, jobsDir);
if (probeError) {
  console.error(`xtext-worker refusing to start: ${probeError}`);
  process.exit(1);
}

// jobStore.ts lives in the site's TypeScript source tree and is addressed
// everywhere else in the app by the "@/" path alias (tsconfig.json). Plain
// Node has no notion of that alias, or of TypeScript's own extension-less
// relative specifiers — aliasLoader.mjs is the bridge; see its own header
// and the task 10 report for why this was chosen over a runtime dependency.
register(pathToFileURL(path.join(HERE, "aliasLoader.mjs")).href, import.meta.url);

const { listAllJobs, backfillJobIndex, advance, getPayload } = await import(
  pathToFileURL(path.join(REPO_ROOT, "src/lib/folkloreJob/jobStore.ts")).href
);

// The folklore board wiring: A1's codec (the one shape check and the one
// encoder) and A2's idempotent index writers, injected so worker.mjs can
// carry link and comment jobs on the same rails without a second formula
// for either the record bytes or the board writes.
const { encodeRecord, recordFromValue } = await import(
  pathToFileURL(path.join(REPO_ROOT, "src/app/folklore/linkRecord.ts")).href
);
const { addCommentToIndex, addLinkToBoard } = await import(
  pathToFileURL(path.join(REPO_ROOT, "src/lib/folkloreBoard.ts")).href
);
const folklore = { encodeRecord, recordFromValue, addLinkToBoard, addCommentToIndex };

const registerBaseUrl = process.env.XTEXT_REGISTER_BASE_URL ?? "https://www.henceforth.club";

let ticking = false;

async function tick() {
  if (ticking) return; // the previous tick is still waiting on a network call — never overlap
  ticking = true;
  try {
    // One index read per tick. The eight listJobsInState calls inside a tick
    // used to each KEYS the whole prefix — eight commands every 15s, empty
    // or not, which spent the 500,000-command month in ~11 days with no
    // visitors. Filter the snapshot in memory. An empty pipeline returns
    // here after the one smembers, and skips the rest of the tick.
    const snapshot = await listAllJobs();
    if (snapshot.length === 0) return;
    const listJobsInState = async (state) => snapshot.filter((j) => j.state === state);
    await runWorkerTick({
      listJobsInState,
      advance,
      getPayload,
      wrapKey,
      jobsDir,
      revenueAddress: REVENUE_ADDRESS,
      floatPoolAddress: FLOAT_POOL_ADDRESS,
      feeRate: FEE_PER_KB,
      fetchFn: fetch,
      taalApiKey: process.env.XTEXT_TAAL_API_KEY,
      registerBaseUrl,
      folklore,
      nowMs: Date.now(),
    });
  } catch (err) {
    // runWorkerTick guards every phase internally, so reaching here would be
    // a bug in the guard itself — logged, not fatal, so the interval keeps running.
    console.error("xtext-worker: a tick threw outside its own guards:", err);
  } finally {
    ticking = false;
  }
}

const backfilled = await backfillJobIndex();
console.log(
  `xtext-worker: starting — ticking every ${TICK_MS / 1000} seconds, registering against ${registerBaseUrl}` +
    (backfilled ? `, job index holds ${backfilled}` : ""),
);
tick();
setInterval(tick, TICK_MS);
