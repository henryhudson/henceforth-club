import { describe, expect, it } from "vitest";
import { foldReadings, overflowNames, refusedSheetMark, refusedSheetPath, sheetOverflow } from "./render-pdf-core.mjs";

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
    expect(sheetOverflow({ packOverflow: 44, pastMax: 0 })).toBe(44);
  });
  it("reads how far the elements run past the edge, the weekly edition's only reading", () => {
    expect(sheetOverflow({ packOverflow: 0, pastMax: 64 })).toBe(64);
  });
  it("takes the larger of the two readings and never goes negative", () => {
    expect(sheetOverflow({ packOverflow: 3, pastMax: 64 })).toBe(64);
    expect(sheetOverflow({ packOverflow: 0, pastMax: -5 })).toBe(0);
    expect(sheetOverflow({})).toBe(0);
    expect(sheetOverflow({ packOverflow: NaN, pastMax: NaN })).toBe(0);
  });
});

describe("overflowNames", () => {
  it("is silent when nothing ran past the edge", () => {
    expect(overflowNames([])).toBe("");
    expect(overflowNames(undefined)).toBe("");
  });
  it("names what ran past the edge, deepest first, with the text to tighten", () => {
    const text = overflowNames([{ by: 64, tag: "p", cls: "agate", text: "Missed. The benchmarks table" }, { by: 12, tag: "span", cls: "", text: "Sat 19" }]);
    expect(text).toContain("past the page edge:");
    expect(text).toContain('  64px past the edge: <p class="agate"> "Missed. The benchmarks table"');
    expect(text).toContain('  12px past the edge: <span> "Sat 19"');
  });
  it("names the page an element sits on when the book's reading carries it", () => {
    const text = overflowNames([{ by: 85, tag: "span", cls: "", text: "Press the release.", page: "week" }, { by: 3, tag: "li", cls: "", text: "Later", page: "month" }]);
    expect(text).toContain('  85px past the edge of the week page: <span> "Press the release."');
    expect(text).toContain('   3px past the edge of the month page: <li> "Later"');
  });
});

describe("foldReadings", () => {
  it("reads the sheet alone as before: the daily and the weekly edition are one part, and nothing is named by page", () => {
    const sheet = { page: null, pastMax: 64, past: [{ by: 64, tag: "p", cls: "agate", text: "Missed." }] };
    expect(foldReadings([sheet])).toEqual({ pastMax: 64, past: [{ by: 64, tag: "p", cls: "agate", text: "Missed." }] });
  });

  it("folds the deepest run on any page of the book into one reading and names the page each element sits on, deepest first across the pages", () => {
    // The 15 September 2026 shape: the front fits, the week page's Tuesday
    // runs past its section, and the month page is a hair over.
    const front = { page: "front", pastMax: 0, past: [] };
    const week = { page: "week", pastMax: 85, past: [{ by: 85, tag: "span", cls: "", text: "Press the release." }, { by: 12, tag: "b", cls: "", text: "Tuesday" }] };
    const month = { page: "month", pastMax: 3, past: [{ by: 3, tag: "li", cls: "", text: "Later" }] };
    expect(foldReadings([front, week, month])).toEqual({
      pastMax: 85,
      past: [
        { by: 85, tag: "span", cls: "", text: "Press the release.", page: "week" },
        { by: 12, tag: "b", cls: "", text: "Tuesday", page: "week" },
        { by: 3, tag: "li", cls: "", text: "Later", page: "month" },
      ],
    });
  });

  it("names six elements at most across the book, and reads nothing as nothing", () => {
    const parts = ["todo", "day", "week"].map((page) => ({
      page,
      pastMax: 10,
      past: Array.from({ length: 4 }, (_, i) => ({ by: 10 - i, tag: "p", cls: "", text: `${page} ${i}` })),
    }));
    expect(foldReadings(parts).past).toHaveLength(6);
    expect(foldReadings(parts).past.map((p) => p.by)).toEqual([10, 10, 10, 9, 9, 9]);
    expect(foldReadings([])).toEqual({ pastMax: 0, past: [] });
    expect(foldReadings(undefined)).toEqual({ pastMax: 0, past: [] });
    expect(foldReadings([{ page: "day", pastMax: NaN }]).pastMax).toBe(0);
  });
});
