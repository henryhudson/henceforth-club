import { describe, expect, it } from "vitest";
import { refusedSheetMark, refusedSheetPath, sheetOverflow } from "./render-pdf-core.mjs";

describe("refusedSheetMark", () => {
  it("says on its face that the sheet did not fit, by how much, and that it must not be printed", () => {
    const html = refusedSheetMark(44, "daily 2026-09-12");
    expect(html).toContain("DID NOT FIT");
    expect(html).toContain("overflows by 44 px");
    expect(html).toContain("NOT THE EDITION");
    expect(html).toContain("DO NOT PRINT");
    expect(html).toContain("daily 2026-09-12");
  });

  it("is a full-bleed overlay positioned against its container, so it survives the sheet's print rule", () => {
    // The 12 September sheet was printed from the opened diagnostic copy. A
    // mark in a margin would have been trimmed or missed; this one covers the
    // page and forces its background through the print colour setting.
    //
    // ABSOLUTE, not fixed. A4Sheet's print stylesheet hides everything under
    // body and re-shows only .a4-print-root and its children, so the mark
    // must be a child of the sheet and fill the sheet. A fixed body-level
    // overlay was the first cut; it rendered nothing on the page.
    const html = refusedSheetMark(44, "daily");
    expect(html).toContain("position:absolute");
    expect(html).not.toContain("position:fixed");
    expect(html).toContain("inset:0");
    expect(html).toContain("print-color-adjust:exact");
    expect(html).toContain("pointer-events:none");
    expect(html).toMatch(/z-index:\d{6,}/);
  });

  it("rounds the overflow to whole pixels and never reports a negative one", () => {
    expect(refusedSheetMark(43.6, "x")).toContain("overflows by 44 px");
    expect(refusedSheetMark(-3, "x")).toContain("overflows by 0 px");
    expect(refusedSheetMark("nonsense", "x")).toContain("overflows by 0 px");
  });

  it("strips markup characters from the label rather than injecting them", () => {
    const html = refusedSheetMark(1, 'daily <script>"x"</script>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    // The letters survive; the angle brackets and quotes do not. The slash
    // and the space are harmless and are left, which is what the label shows.
    expect(html).toContain("daily scriptx/script");
  });
});

describe("refusedSheetPath", () => {
  it("renames the script's own temporary sheet so it cannot be mistaken for a good one", () => {
    expect(refusedSheetPath("/tmp/board-daily-2026-09-12.pdf", false))
      .toBe("/tmp/board-daily-2026-09-12-DID-NOT-FIT.pdf");
    expect(refusedSheetPath("/tmp/board-board-2026-09-12-todo.PDF", false))
      .toBe("/tmp/board-board-2026-09-12-todo-DID-NOT-FIT.pdf");
  });

  it("leaves a path the caller chose with --out untouched", () => {
    expect(refusedSheetPath("/Users/h/Desktop/preview.pdf", true)).toBe("/Users/h/Desktop/preview.pdf");
  });
});

describe("sheetOverflow", () => {
  it("reads the packed daily's own residual", () => {
    expect(sheetOverflow({ packOverflow: 44, scrollHeight: 1000, clientHeight: 1000 })).toBe(44);
  });
  it("reads the clipped height of a sheet with no pack root, the weekly edition's case", () => {
    expect(sheetOverflow({ packOverflow: 0, scrollHeight: 1187, clientHeight: 1123 })).toBe(64);
  });
  it("takes the larger of the two readings and never goes negative", () => {
    expect(sheetOverflow({ packOverflow: 3, scrollHeight: 1187, clientHeight: 1123 })).toBe(64);
    expect(sheetOverflow({ packOverflow: 0, scrollHeight: 900, clientHeight: 1123 })).toBe(0);
    expect(sheetOverflow({})).toBe(0);
    expect(sheetOverflow({ packOverflow: NaN, scrollHeight: NaN, clientHeight: 5 })).toBe(0);
  });
});
