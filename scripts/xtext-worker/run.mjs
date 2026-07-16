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
import { wrappingKeyFromKeychain } from "./keystore.mjs";
import { FEE_PER_KB, REVENUE_ADDRESS, revenueAddressError, runWorkerTick } from "./worker.mjs";

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

let wrapKey;
try {
  wrapKey = wrappingKeyFromKeychain();
} catch (err) {
  console.error("xtext-worker refusing to start: could not read the Keychain wrapping key.", err.message);
  console.error("Seed it first: security add-generic-password -s xtext-worker-wrap -w <32 random bytes hex>");
  process.exit(1);
}

// jobStore.ts lives in the site's TypeScript source tree and is addressed
// everywhere else in the app by the "@/" path alias (tsconfig.json). Plain
// Node has no notion of that alias, or of TypeScript's own extension-less
// relative specifiers — aliasLoader.mjs is the bridge; see its own header
// and the task 10 report for why this was chosen over a runtime dependency.
register(pathToFileURL(path.join(HERE, "aliasLoader.mjs")).href, import.meta.url);

const { listJobsInState, advance, getPayload } = await import(
  pathToFileURL(path.join(REPO_ROOT, "src/lib/folkloreJob/jobStore.ts")).href
);

const jobsDir = path.join(HERE, "jobs");
const registerBaseUrl = process.env.XTEXT_REGISTER_BASE_URL ?? "https://www.henceforth.club";

let ticking = false;

async function tick() {
  if (ticking) return; // the previous tick is still waiting on a network call — never overlap
  ticking = true;
  try {
    await runWorkerTick({
      listJobsInState,
      advance,
      getPayload,
      wrapKey,
      jobsDir,
      revenueAddress: REVENUE_ADDRESS,
      feeRate: FEE_PER_KB,
      fetchFn: fetch,
      taalApiKey: process.env.XTEXT_TAAL_API_KEY,
      registerBaseUrl,
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

console.log(`xtext-worker: starting — ticking every ${TICK_MS / 1000} seconds, registering against ${registerBaseUrl}`);
tick();
setInterval(tick, TICK_MS);
