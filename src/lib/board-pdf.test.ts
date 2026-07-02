import { describe, expect, it } from "vitest";
import { blobPathname, downloadFilename } from "./board-pdf";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("board-pdf naming", () => {
  it("builds blob pathnames", () => {
    expect(blobPathname("daily", "2026-07-02")).toBe("board-pdfs/daily-2026-07-02.pdf");
    expect(blobPathname("week", "2026-06-29")).toBe("board-pdfs/week-2026-06-29.pdf");
  });
  it("builds download filenames", () => {
    expect(downloadFilename("daily", "2026-07-02")).toBe("henceforth-daily-2026-07-02.pdf");
    expect(downloadFilename("week", "2026-06-29")).toBe("henceforth-week-2026-06-29.pdf");
  });
});

describe("render script naming stays in sync", () => {
  it("the script's blobPathname literal matches the library", () => {
    const script = readFileSync(join(process.cwd(), "scripts/board/render-pdf.mjs"), "utf8");
    expect(script).toContain("`board-pdfs/${kind}-${date}.pdf`");
  });
});
