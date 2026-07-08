import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every source file under the /x route tree, recursively, tests excluded. */
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
  const files = sourcesUnder("src/app/x");

  it("finds source files to check, because a vacuous pass is not a pass", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(FORBIDDEN)("no file under src/app/x mentions %s", (needle) => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes(needle));
    expect(offenders).toEqual([]);
  });

  it("costs nothing to run: no file under src/app/x reads an environment variable", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("process.env"));
    expect(offenders).toEqual([]);
  });
});
