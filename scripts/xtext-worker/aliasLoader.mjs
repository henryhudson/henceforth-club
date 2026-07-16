// The bridge that lets scripts/xtext-worker/run.mjs (plain Node, no build
// step) import src/lib/folkloreJob/jobStore.ts directly. Two things a bundler or
// ts-node would normally handle are missing from plain Node: the "@/" path
// alias (tsconfig.json's only path mapping, to ./src) and TypeScript's own
// convention of writing a relative import with no file extension. Node's own
// TypeScript support (unflagged, since this repo's Node version) already
// strips the syntax once a file is FOUND — this hook only ever changes WHICH
// file that is, then hands back to Node's default resolution for everything
// else (including the actual syntax stripping).
//
// Registered once, in run.mjs, via node:module's register(). See the task 10
// report for why this tiny hook was chosen over adding a runtime dependency
// (tsx, ts-node) just to satisfy one path alias.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");

// The order TypeScript itself tries when a specifier has no extension —
// "" first, so a specifier that is already a real file (any extension,
// including one that already ends .mjs) resolves to itself unchanged.
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function firstExistingFile(base) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = base + suffix;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = firstExistingFile(path.join(SRC_ROOT, specifier.slice(2)));
    if (found) return nextResolve(pathToFileURL(found).href, context);
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const found = firstExistingFile(path.join(parentDir, specifier));
    if (found) return nextResolve(pathToFileURL(found).href, context);
  }

  return nextResolve(specifier, context);
}
