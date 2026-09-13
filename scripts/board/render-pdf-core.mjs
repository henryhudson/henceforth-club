// The pure half of render-pdf.mjs: what a refused sheet must look like and be
// called, so it can never be mistaken for the edition.
//
// On 12 September 2026 the daily's first render overflowed, the budget check
// refused it correctly, the copy was tightened and the 09:26 re-render was
// archived. But the script writes the refused sheet to disk and opens it for
// diagnosis BEFORE the check throws — same masthead, same date, no mark of
// any kind — and that 09:21 sheet is the one that reached the printer, with
// its last plan item clipped mid-sentence. A refused sheet has to carry its
// refusal on its face.

/** The mark stamped onto a sheet the budget check is about to refuse. A
 *  full-bleed, pointer-inert overlay with one diagonal band, so it survives
 *  `printBackground: true`, covers every column, and cannot be read past.
 *  Injected into the document before the PDF is generated, which is the
 *  only moment it can be: the overflow is known before `page.pdf()` and the
 *  bytes are fixed after.
 *
 *  It is positioned ABSOLUTE, against its container, and the renderer puts it
 *  inside the sheet (`.a4-print-root`) rather than on `body`. The sheet's
 *  print stylesheet hides every element under `body` and then shows only the
 *  print root and its descendants — the usual "print just the sheet" rule —
 *  so a body-level overlay is in the DOM and invisible on paper. The first
 *  cut of this was exactly that, and the rasterised PDF came back clean.
 *  In print the root is itself `position:absolute`, which makes it the
 *  containing block this overlay fills. */
export function refusedSheetMark(overflowPx, label) {
  const px = Math.max(0, Math.round(Number(overflowPx) || 0));
  const text = `DID NOT FIT · overflows by ${px} px · NOT THE EDITION · DO NOT PRINT`;
  const which = String(label ?? "").replace(/[<>&"]/g, "");
  return (
    `<div data-refused-sheet style="position:absolute;inset:0;z-index:2147483647;` +
    `pointer-events:none;display:flex;align-items:center;justify-content:center;` +
    `background:rgba(255,255,255,0.28);-webkit-print-color-adjust:exact;print-color-adjust:exact">` +
    `<div style="transform:rotate(-28deg);border:6px solid #b00020;color:#b00020;` +
    `background:rgba(255,255,255,0.92);padding:14px 28px;font:700 26px/1.25 Helvetica,Arial,sans-serif;` +
    `letter-spacing:.06em;text-align:center;text-transform:uppercase;max-width:78%">` +
    `${text}<br><span style="font-size:14px;font-weight:400;letter-spacing:.02em;text-transform:none">${which}</span>` +
    `</div></div>`
  );
}

/** The refused sheet's own filename. `board-daily-2026-09-12.pdf` becomes
 *  `board-daily-2026-09-12-DID-NOT-FIT.pdf`, so a later successful render of
 *  the same date never lands on top of it and a folder listing tells the two
 *  apart without opening either. A path a caller chose with `--out` is left
 *  alone: they named it, they know what it is. */
export function refusedSheetPath(localPath, callerChoseIt) {
  if (callerChoseIt) return localPath;
  return localPath.replace(/\.pdf$/i, "-DID-NOT-FIT.pdf");
}

/**
 * How far a sheet's content runs past the page, in pixels. The packed daily
 * reports its own residual through data-pack-overflow after shrinking the
 * type; every sheet (the weekly edition, the board) reports how far its
 * elements' own boxes run past the page edge, which is what the 297mm sheet
 * clips with overflow hidden. On 13 September 2026 the weekly edition lost
 * its two footer bands this way while the gate read zero, because it only
 * asked the pack. scrollHeight is not the measure: on the daily it over-read
 * by 111px with nothing visible past the edge. The larger reading is the truth.
 */
export function sheetOverflow({ packOverflow = 0, pastMax = 0 } = {}) {
  const pack = Number.isFinite(packOverflow) ? Math.max(0, packOverflow) : 0;
  const past = Number.isFinite(pastMax) ? Math.max(0, pastMax) : 0;
  return Math.max(pack, past);
}

/** The refusal's postscript: what ran past the page edge, deepest first. Empty when nothing is named. */
export function overflowNames(past = []) {
  if (!Array.isArray(past) || past.length === 0) return "";
  const lines = past.map((p) => `  ${String(p.by).padStart(4)}px past the edge: <${p.tag}${p.cls ? ` class="${p.cls}"` : ""}> ${JSON.stringify(p.text ?? "")}`);
  return `\n  past the page edge:\n${lines.join("\n")}`;
}
