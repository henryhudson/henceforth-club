import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every source file under the /folklore route tree, recursively, tests excluded. */
function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.(ts|tsx)$/.test(entry) && !entry.includes(".test.") ? [path] : [];
  });
}

const FORBIDDEN = [
  "api.twitter.com",  // X's application programming interface, by hostname
  "xfetch",           // the module that holds the bearer token
  "xPaginate",        // the module that pages a timeline
  "X_BEARER_TOKEN",   // the token itself
];

describe("the showroom never reaches X", () => {
  const files = sourcesUnder("src/app/folklore");

  it("finds source files to check, because a vacuous pass is not a pass", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(FORBIDDEN)("no file under src/app/folklore mentions %s", (needle) => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes(needle));
    expect(offenders).toEqual([]);
  });

  it("costs nothing to run: no file under src/app/folklore reads an environment variable, other than the web archive's own mechanical gate", () => {
    // XTEXT_WEB_ARCHIVE_ENABLED (task 10, src/app/folklore/archive/page.tsx) is an
    // in-house feature flag, never a credential and never a path to X's
    // costed application programming interface — the one allowed exception
    // to this invariant.
    const offenders = files.filter((f) => {
      const content = readFileSync(f, "utf8").replaceAll("process.env.XTEXT_WEB_ARCHIVE_ENABLED", "");
      return content.includes("process.env");
    });
    expect(offenders).toEqual([]);
  });
});
