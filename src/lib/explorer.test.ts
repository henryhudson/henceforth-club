import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { txExplorerUrl } from "./explorer";

describe("txExplorerUrl", () => {
  it("points a transaction at BananaBlocks", () => {
    const txid = "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b";
    expect(txExplorerUrl(txid)).toBe(`https://bananablocks.com/tx/${txid}`);
  });
});

// One guard for the whole class rather than a test per component. Five folklore
// components each hardcoded a WhatsOnChain transaction link while the helper
// above already existed, and nothing caught the drift because none of those
// components had a test at all. This fails the moment a new link-out is
// hardcoded anywhere under folklore, which is the only way to keep them
// agreeing as components are added.
//
// Deliberately scoped to LINK-OUTS. Byte fetches stay on WhatsOnChain by
// design (folklore board spec, question four), so src/lib/whatsonchain.ts,
// xPayment.ts, xPrice.ts and board-pdf-serve.ts are correct as they are and
// are not in this directory.
describe("folklore explorer link-outs", () => {
  const dir = path.join(__dirname, "..", "app", "folklore", "_components");

  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((f) => ({ file: f, text: readFileSync(path.join(dir, f), "utf8") }));

  it("has components to check", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it("routes every transaction link through the helper, never a hardcoded explorer", () => {
    const offenders = sources
      .filter(({ text }) => /whatsonchain\.com\/tx\//.test(text))
      .map(({ file }) => file);

    expect(
      offenders,
      `hardcoded a transaction explorer instead of using txExplorerUrl: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("imports the helper wherever it links a transaction", () => {
    const missing = sources
      .filter(({ text }) => text.includes("txExplorerUrl(") && !text.includes('from "@/lib/explorer"'))
      .map(({ file }) => file);

    expect(missing, `uses txExplorerUrl without importing it: ${missing.join(", ")}`).toEqual([]);
  });
});
