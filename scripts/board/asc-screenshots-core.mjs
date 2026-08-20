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
 * files:  [{ name, width, height }]
 * sets:   [{ id, displayType, sizes: [[w, h], ...], count }]  — sizes of the
 *         screenshots the set currently holds (inherited from the live version).
 * forced: { "WxH": setId } — explicit size-to-set overrides for a set whose
 *         identity was erased (a run that deleted a set's screenshots and then
 *         failed before uploading leaves it empty and unmatchable — the
 *         2026-08-19 review's stranding case; the driver's --assign flag feeds
 *         this recovery path).
 *
 * Returns { assignments, unmatched }; assignments carry files in name order
 * (the export names NN-<id>-<w>x<h>.png, so name order is slide order).
 */
export function planScreenshotUpdate({ files, sets, forced = {} }) {
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
    const forcedId = forced[size];
    const matches = forcedId
      ? sets.filter((s) => s.id === forcedId)
      : sets.filter((s) => s.sizes.some(([sw, sh]) => sw === w && sh === h));
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
        reason: forcedId
          ? `forced set ${forcedId} does not exist on this localization`
          : matches.length === 0
            ? "no screenshot set currently holds images of this size"
            : `ambiguous — ${matches.map((m) => m.displayType).join(", ")} all hold this size`,
      });
    }
  }

  // A set legitimately holding more than one pixel size (mixed orientations)
  // matches several size groups; without merging, the apply loop would delete
  // the set once per assignment and crash on the second pass (2026-08-19
  // review, SITE-1). Collapse same-set assignments into one, files re-sorted
  // into name order so slide order is preserved across the merged groups.
  const bySet = new Map();
  const merged = [];
  for (const a of assignments) {
    const prior = bySet.get(a.setId);
    if (!prior) {
      bySet.set(a.setId, a);
      merged.push(a);
    } else {
      prior.files = [...prior.files, ...a.files].sort((x, y) => x.localeCompare(y));
      prior.size = `${prior.size}+${a.size}`;
    }
  }
  return { assignments: merged, unmatched };
}

/** The recovery map: one `--assign WxH=setId` line PER SIZE of each
 *  assignment. A merged mixed-orientation assignment carries "WxH+WxH", and
 *  after a mid-apply failure its set is empty — only a forced entry can match
 *  it — so recovery must force EVERY orientation group, not just the first
 *  (2026-08-20 review: the one case the map existed for was the one case it
 *  under-covered). */
export function recoveryLines(assignments) {
  return assignments.flatMap((a) =>
    a.size.split("+").map((size) => `recovery map: --assign ${size}=${a.setId}  (${a.displayType})`),
  );
}
