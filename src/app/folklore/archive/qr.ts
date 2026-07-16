// A pure wrapper around qrcode-generator: text in, a single vector-image
// path out. One <path> covering every dark module — the standard technique
// for a compact scannable payment code, filled by the caller (PaymentPanel
// paints it fixed black on white, since a scan target needs stable contrast
// regardless of the page theme) — rather than one <rect> per module.
//
// qrcode-generator is a small, dependency-free, pure-JavaScript encoder; no
// native code, no canvas. Chosen over the heavier `qrcode` package (which
// pulls in a raster-image encoder this page never uses) since only the
// module matrix is needed here — this file renders the vector image itself.

import qrcode from "qrcode-generator";

export type QrSvg = {
  /** The vector image's viewBox width and height, in modules — includes the quiet-zone margin. */
  size: number;
  /** A single <path> `d` attribute covering every dark module. */
  path: string;
};

/** Modules of quiet zone on each side — qrcode-generator's own convention for createSvgTag. */
const MARGIN = 2;

/** Type 0 = automatic: qrcode-generator picks the smallest version that fits
 * the data. "M" balances scan reliability against payload size for a short
 * bitcoin: uniform resource identifier. */
export function qrSvg(text: string): QrSvg {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();

  const count = code.getModuleCount();
  const commands: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (code.isDark(row, col)) {
        commands.push(`M${col + MARGIN} ${row + MARGIN}h1v1h-1z`);
      }
    }
  }

  return { size: count + MARGIN * 2, path: commands.join("") };
}
