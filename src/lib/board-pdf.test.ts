import { describe, expect, it } from "vitest";
import { CHAIN_MARKER, downloadFilename } from "./board-pdf";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("board-pdf naming", () => {
  it("builds download filenames", () => {
    expect(downloadFilename("daily", "2026-07-02")).toBe("henceforth-daily-2026-07-02.pdf");
    expect(downloadFilename("week", "2026-06-29")).toBe("henceforth-week-2026-06-29.pdf");
  });
});

describe("the chain envelope stays in sync between the scripts and the site", () => {
  it("chain-put-core's marker is the library's marker", () => {
    const core = readFileSync(join(process.cwd(), "scripts/board/chain-put-core.mjs"), "utf8");
    expect(core).toContain(`INSCRIPTION_MARKER = ${JSON.stringify(CHAIN_MARKER)}`);
  });
  it("render-pdf inscribes through chain-put and carries no marker of its own", () => {
    const script = readFileSync(join(process.cwd(), "scripts/board/render-pdf.mjs"), "utf8");
    expect(script).toContain('from "./chain-put.mjs"');
    expect(script).not.toMatch(/INSCRIPTION_MARKER\s*=/);
  });
});
