import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "./aliasLoader.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fileUrl = (repoRelativePath) => pathToFileURL(path.join(REPO_ROOT, repoRelativePath)).href;

function spyNextResolve() {
  return vi.fn(async (specifier, context) => ({ specifier, context, url: specifier }));
}

describe("aliasLoader resolve", () => {
  it("maps an extensionless @/ specifier to the matching .ts file under src/", async () => {
    const nextResolve = spyNextResolve();
    await resolve("@/lib/textJob/jobs", {}, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith(fileUrl("src/lib/textJob/jobs.ts"), {});
  });

  it("maps @/lib/redis the same way — the one runtime alias jobStore.ts actually needs", async () => {
    const nextResolve = spyNextResolve();
    await resolve("@/lib/redis", {}, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith(fileUrl("src/lib/redis.ts"), {});
  });

  it("resolves an extensionless relative specifier against its parent file's directory", async () => {
    const nextResolve = spyNextResolve();
    const context = { parentURL: fileUrl("src/lib/textJob/jobStore.ts") };
    await resolve("./jobs", context, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith(fileUrl("src/lib/textJob/jobs.ts"), context);
  });

  it("leaves a specifier that is already a real file untouched (just converts it to a file url)", async () => {
    const nextResolve = spyNextResolve();
    const context = { parentURL: fileUrl("scripts/xtext-worker/run.mjs") };
    await resolve("./keystore.mjs", context, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith(fileUrl("scripts/xtext-worker/keystore.mjs"), context);
  });

  it("passes an unrelated bare specifier straight through unchanged", async () => {
    const nextResolve = spyNextResolve();
    const context = {};
    await resolve("@bsv/sdk", context, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith("@bsv/sdk", context);
  });

  it("falls through unchanged when nothing on disk matches the alias", async () => {
    const nextResolve = spyNextResolve();
    const context = {};
    await resolve("@/does/not/exist", context, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith("@/does/not/exist", context);
  });
});
