// Pure planning core for asc-screenshots.mjs — separated so the matching rules
// are unit-testable offline (the same shape as scripts/ledger/commit-core.mjs).
//
// The central idea: never hardcode Apple's screenshotDisplayType enum for a
// pixel size. A new version record inherits the previous version's screenshots,
// so every set already CONTAINS images whose dimensions identify it. Local
// files are matched to sets by exact pixel dimensions of what a set already
// holds; anything that cannot be matched unambiguously is reported, never
// guessed — a wrong display type is a 409 at best and a mangled listing at
// worst.

/** Width and height of a PNG, from its IHDR chunk. Null when not a PNG. */
export function pngDimensions(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  if (buf.readUInt32BE(12) !== 0x49484452) return null; // "IHDR"
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Match local files to screenshot sets by exact dimensions.
 *
 * files: [{ name, width, height }]
 * sets:  [{ id, displayType, sizes: [[w, h], ...], count }]  — sizes of the
 *        screenshots the set currently holds (inherited from the live version).
 *
 * Returns { assignments, unmatched }; assignments carry files in name order
 * (the export names NN-<id>-<w>x<h>.png, so name order is slide order).
 */
export function planScreenshotUpdate({ files, sets }) {
  const groups = new Map();
  for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    const key = `${f.width}x${f.height}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }

  const assignments = [];
  const unmatched = [];
  for (const [size, groupFiles] of groups) {
    const [w, h] = size.split("x").map(Number);
    const matches = sets.filter((s) => s.sizes.some(([sw, sh]) => sw === w && sh === h));
    if (matches.length === 1) {
      assignments.push({
        setId: matches[0].id,
        displayType: matches[0].displayType,
        size,
        files: groupFiles.map((f) => f.name),
        replaceCount: matches[0].count,
      });
    } else {
      unmatched.push({
        size,
        files: groupFiles.map((f) => f.name),
        reason:
          matches.length === 0
            ? "no screenshot set currently holds images of this size"
            : `ambiguous — ${matches.map((m) => m.displayType).join(", ")} all hold this size`,
      });
    }
  }
  return { assignments, unmatched };
}
