// The publish step's pure core: classify what went wrong, and say it accurately.
//
// It exists because of a real failure. The old script wrapped each publish in a
// catch that printed "no content/board/latest.json to publish: <error>" — so a
// store that had refused the write was reported as a missing local file, when
// the file was present and had been read fine. It then printed "done" and exited
// 0, so nothing downstream could tell a successful publish from a failed one.
// The board drifted four days behind the truth before anyone noticed, and the
// only reason it surfaced was a card count moving in a log someone read by hand.
//
// Three rules follow, and they are what this module encodes:
//   1. Never describe a failure as something it is not.
//   2. A run that did not reach the store must exit non-zero.
//   3. Loud is not the same as long. When one cause takes down seventy steps,
//      say the cause once and count them — a wall of identical lines is read
//      exactly as carefully as silence is.

export const FILE_MISSING = "file-missing";
export const FILE_UNREADABLE = "file-unreadable";
export const STORE_REFUSED = "store-refused";

/** A read that failed: absent file, or present but unreadable/unparseable. */
export function classifyReadError(error) {
  return error?.code === "ENOENT" ? FILE_MISSING : FILE_UNREADABLE;
}

/**
 * The sentence printed for a failed step. The store-refused wording states
 * plainly that the local file is fine, because getting that backwards is the
 * exact mistake this module was written to prevent.
 */
export function reasonFor(kind, message) {
  switch (kind) {
    case FILE_MISSING:
      return `the local file is missing (${message})`;
    case FILE_UNREADABLE:
      return `the local file is present but could not be read or parsed (${message})`;
    case STORE_REFUSED:
      return `the store refused the write; the local file is present and was read fine (${message})`;
    default:
      return message;
  }
}

const NAMED = 3;

/**
 * Reduce the run's steps to what to print and what to exit with.
 * `steps` is [{ name, failed, reason }]. Failures sharing a reason are grouped:
 * the reason once, then the count and the first few names, so nothing is hidden
 * and nothing is repeated seventy times.
 */
export function summarise(steps) {
  const failed = steps.filter((s) => s.failed);
  if (failed.length === 0) {
    return { exitCode: 0, lines: ["done"] };
  }

  const byReason = new Map();
  for (const s of failed) {
    const group = byReason.get(s.reason) ?? [];
    group.push(s.name);
    byReason.set(s.reason, group);
  }

  const lines = [`publish FAILED — ${failed.length} of ${steps.length} step(s) did not reach the store:`];
  for (const [reason, names] of byReason) {
    lines.push(`  · ${reason}`);
    const shown = names.slice(0, NAMED).join(", ");
    lines.push(
      names.length > NAMED
        ? `    ${names.length} steps: ${shown} … and ${names.length - NAMED} more`
        : `    ${names.length === 1 ? "step" : `${names.length} steps`}: ${shown}`,
    );
  }
  lines.push("The local files are unchanged. Do not treat this run as a publish.");
  return { exitCode: 1, lines };
}
