// Pure parsing core for the gardening schedule (~/Gardening/schedule.md) —
// separated so the Morning Edition's garden diary is unit-testable offline,
// the same shape as asc-screenshots-core.mjs.
//
// The schedule's shape (established 2026-08-20): one `## Section` per rhythm,
// each holding a markdown table whose first column is an ISO date and whose
// LAST column is the status ("Done" or blank). Three-column tables carry a
// label in the middle (the film or episode name).

/** Parse the schedule markdown into flat rows: [{ section, date, label, done }]. */
export function parseGardeningSchedule(markdown) {
  const jobs = [];
  let section = null;
  for (const line of markdown.split("\n")) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      section = h[1];
      continue;
    }
    if (!section) continue;
    const cells = line.match(/^\|(.+)\|\s*$/);
    if (!cells) continue;
    const cols = cells[1].split("|").map((c) => c.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cols[0])) continue; // header/rule rows
    jobs.push({
      section,
      date: cols[0],
      label: cols.length > 2 ? cols[1] : null,
      // A lone-date row has no status column at all — the date would read as
      // its own status and the job would silently vanish from the diary, so
      // it parses as undone rather than done.
      done: cols.length > 1 && cols[cols.length - 1] !== "",
    });
  }
  return jobs;
}

// The diary SELECTION (next undone job per section) lives with the page that
// renders it: src/lib/gardening.ts, tested there. This file stays the parser.
