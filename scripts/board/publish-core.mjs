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
// The store refusing a READ is not the store refusing a write. The board step
// reads the last good board before it writes anything (the collapse guard), and
// a read that throws leaves the run holding with nothing attempted. Calling
// that a refused write names an operation the run never reached, which rule 1
// above forbids as plainly as the missing-file mislabel it was written for.
export const STORE_UNREADABLE = "store-unreadable";
export const CHAIN_REFUSED = "chain-refused";
// A board with fewer than half the store's cards or a dateline behind it
// (autosync-core.mjs, boardLooksCollapsed). The store and the chain keep the
// last good board; the local file is the one that is wrong.
export const BOARD_COLLAPSED = "board-collapsed";

/** A read that failed: absent file, or present but unreadable/unparseable. */
export function classifyReadError(error) {
  return error?.code === "ENOENT" ? FILE_MISSING : FILE_UNREADABLE;
}

/**
 * The sentence printed for a cause. The store-refused wording states plainly
 * that the local file is fine, because getting that backwards is the exact
 * mistake this module was written to prevent.
 *
 * The failure's own message is deliberately NOT folded in here. A cause is
 * what a reader needs stated once however many steps it took down, and a
 * message varies with the step: the Upstash client's auto-pipelining path
 * throws `Command failed: ${error}` with no command echo, but its direct
 * request path echoes `command was: [...]`, which names the key. Interpolating
 * the message made every step's sentence unique on that path, so rule 3 above
 * (say the cause once and count the steps) held only by luck of which path the
 * client happened to take. The message rides the detail line instead.
 */
export function reasonFor(kind) {
  switch (kind) {
    case FILE_MISSING:
      return "the local file is missing";
    case FILE_UNREADABLE:
      return "the local file is present but could not be read or parsed";
    case STORE_REFUSED:
      return "the store refused the write; the local file is present and was read fine";
    case STORE_UNREADABLE:
      return "the store could not be read, so the collapse guard could not run and the board was held; nothing was written";
    case CHAIN_REFUSED:
      return "the chain refused the inscription; the local file is present and was read fine";
    case BOARD_COLLAPSED:
      return "the board has collapsed and was refused; the store's last good board stands";
    default:
      return "the cause was not classified";
  }
}

const NAMED = 3;

/**
 * Reduce the run's steps to what to print and what to exit with.
 * `steps` is [{ name, failed, kind, message }]. Failures are grouped by CAUSE,
 * not by the sentence a cause and a message happen to compose: the cause once,
 * then the count and the first few names, then the message. Grouping on the
 * composed sentence made one cause read as many the moment the messages
 * differed, which is the same wall of near-identical lines rule 3 above was
 * written against, and a wall is read exactly as carefully as silence is.
 */
export function summarise(steps) {
  const failed = steps.filter((s) => s.failed);
  if (failed.length === 0) {
    return { exitCode: 0, lines: ["done"] };
  }

  const byKind = new Map();
  for (const s of failed) {
    const group = byKind.get(s.kind) ?? { names: [], messages: [] };
    group.names.push(s.name);
    if (!group.messages.includes(s.message)) group.messages.push(s.message);
    byKind.set(s.kind, group);
  }

  const lines = [`publish FAILED — ${failed.length} of ${steps.length} step(s) did not reach the store:`];
  for (const [kind, { names, messages }] of byKind) {
    lines.push(`  · ${reasonFor(kind)}`);
    const shown = names.slice(0, NAMED).join(", ");
    lines.push(
      names.length > NAMED
        ? `    ${names.length} steps: ${shown} … and ${names.length - NAMED} more`
        : `    ${names.length === 1 ? "step" : `${names.length} steps`}: ${shown}`,
    );
    // One message stands for the cause; when the steps worded it differently
    // the count of the rest says so rather than hiding them.
    const others = messages.length - 1;
    lines.push(`    ${messages[0]}${others > 0 ? ` (and ${others} other wording${others === 1 ? "" : "s"})` : ""}`);
  }
  lines.push("The local files are unchanged. Do not treat this run as a publish.");
  return { exitCode: 1, lines };
}
