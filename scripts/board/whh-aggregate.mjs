// Pure aggregation over a week of daily /hh report JSONs + the kanban board.
// Every function is computed purely from its arguments (no input/output) and unit-tested. Consumed by whh-run.mjs.

/** Trailing `days` calendar dates ending `endDate`, ascending (UTC). */
export function windowDates(endDate, days = 7) {
  const end = new Date(`${endDate}T00:00:00Z`);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** `date` (YYYY-MM-DD) advanced by `n` days (UTC). */
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Parse a "n/m" survival string; tolerant of numbers and junk. */
export function parseSurvived(value) {
  if (typeof value === "number") return { survived: value, total: value };
  if (typeof value !== "string") return { survived: 0, total: 0 };
  const m = value.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { survived: Number(m[1]), total: Number(m[2]) } : { survived: 0, total: 0 };
}

const SUMMARY_KEYS = ["reviews", "confirmed", "rejected", "abstained", "alreadyResolved", "skipped", "newConfirmedDefects", "boardMoves"];

/** Sum numeric summary fields across reports; verdictsSurvivedRefutation parsed as n/m. */
export function aggregateTotals(reports) {
  const totals = Object.fromEntries(SUMMARY_KEYS.map((k) => [k, 0]));
  let survived = 0, survivedTotal = 0;
  for (const r of reports) {
    const s = r.summary ?? {};
    for (const k of SUMMARY_KEYS) totals[k] += Number(s[k] ?? 0);
    const v = parseSurvived(s.verdictsSurvivedRefutation);
    survived += v.survived; survivedTotal += v.total;
  }
  return { ...totals, verdictsSurvived: survived, verdictsTotal: survivedTotal };
}

// The daily reports write "agree"; older ones wrote "confirm". Both mean the same
// verdict, so both fold onto the same counter — keeping the output key "confirm"
// so the published week page needs no change.
const VERDICT_KEY = {
  agree: "confirm",
  confirm: "confirm",
  reject: "reject",
  abstain: "abstain",
  "already-resolved": "already-resolved",
};

/** Per-app verdict counts across the week. */
export function perApp(reports) {
  const byApp = new Map();
  for (const r of reports) for (const a of r.apps ?? []) {
    const cur = byApp.get(a.app) ?? { app: a.app, name: a.name ?? a.app, reviews: 0, confirm: 0, reject: 0, abstain: 0, "already-resolved": 0 };
    if (a.reviewFound) cur.reviews += 1;
    for (const f of a.findings ?? []) {
      const key = VERDICT_KEY[f.verdict];
      if (key) cur[key] += 1;
    }
    byApp.set(a.app, cur);
  }
  return [...byApp.values()];
}

/** Review-quality ratios; null where the denominator is zero. */
export function ratios(t) {
  const confirmRejectRatio = t.rejected === 0 ? null : t.confirmed / t.rejected;
  const adjudicated = t.confirmed + t.rejected + t.abstained;
  const abstainRate = adjudicated === 0 ? 0 : t.abstained / adjudicated;
  const survivedRefutation = t.verdictsTotal === 0 ? null : t.verdictsSurvived / t.verdictsTotal;
  return { confirmRejectRatio, abstainRate, survivedRefutation };
}

/** Strip volatile suffixes from a finding title to get a stable fallback signature. */
export function reflagSignature(title) {
  return String(title)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")                                   // drop parentheticals e.g. ("bill--1"), (defect, 5th re-flag)
    .replace(/\d+(?:st|nd|rd|th)\s+(?:re-?flag|dismissal)/g, " ") // drop ordinal phrases anywhere
    .replace(/[^a-z0-9]+/g, " ")                                  // punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
}

const FILE_RE = /\b([A-Za-z]\w*\.swift)\b/;
const ORDINAL = /(\d+)(?:st|nd|rd|th)\s+(?:re-?flag|dismissal)/i;

/** A stable grouping key for a finding: the first Swift file it cites (in title or evidence),
 *  else the normalized title. Findings re-derived from the same code cite the same file. */
export function reflagKey(finding) {
  const fileHit = `${finding.title ?? ""} ${finding.evidence ?? ""}`.match(FILE_RE);
  if (fileHit) return fileHit[1].toLowerCase();
  return reflagSignature(finding.title ?? "");
}

/** Findings the reviewer keeps re-deriving: grouped by reflagKey, recurring when seen on
 *  more than one day or self-reporting an ordinal of 2 or more. The shown title and status
 *  are anchored to the most-escalated finding in the group (highest ordinal, latest date
 *  breaking ties) so a stray already-resolved file-mate cannot mislabel a chronic rejection. */
export function recurringReflags(reports) {
  const groups = new Map();
  for (const r of reports) for (const a of r.apps ?? []) for (const f of a.findings ?? []) {
    const sig = reflagKey(f);
    if (!sig) continue;
    const key = `${a.app}::${sig}`;
    const g = groups.get(key) ?? { signature: sig, app: a.app, title: f.title, days: [], maxOrdinal: 0, anchorOrd: -1, anchorDate: "", anchorVerdict: f.verdict };
    g.days.push(r.date);
    const m = `${f.title} ${f.recommendation ?? ""}`.match(ORDINAL);
    const ord = m ? Number(m[1]) : 0;
    g.maxOrdinal = Math.max(g.maxOrdinal, ord);
    if (ord > g.anchorOrd || (ord === g.anchorOrd && r.date >= g.anchorDate)) {
      g.anchorOrd = ord; g.anchorDate = r.date; g.anchorVerdict = f.verdict; g.title = f.title;
    }
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.days.length > 1 || g.maxOrdinal >= 2)
    .map((g) => ({
      signature: g.signature, app: g.app, title: g.title,
      timesFlagged: Math.max(g.days.length, g.maxOrdinal),
      firstSeen: g.days.slice().sort()[0],
      status: g.anchorVerdict === "reject" ? "serially-rejected"
            : g.anchorVerdict === "already-resolved" ? "resolved"
            : g.anchorVerdict === "confirm" ? "carded" : "open",
    }))
    .sort((a, b) => b.timesFlagged - a.timesFlagged);
}

/** Earliest ISO date embedded anywhere in free text, or null. */
export function earliestDateIn(text) {
  const m = String(text).match(/\d{4}-\d{2}-\d{2}/g);
  return m ? m.sort()[0] : null;
}

/** Column census + cards stuck in inprogress/review since before the window. */
export function throughput(board, windowStart) {
  const cards = board?.cards ?? [];
  const census = {};
  for (const c of cards) census[c.col] = (census[c.col] ?? 0) + 1;
  const stuck = cards
    .filter((c) => c.col === "inprogress" || c.col === "review")
    .map((c) => ({ id: c.id, title: c.title, app: (c.apps ?? [])[0] ?? "*", col: c.col, firstSeen: earliestDateIn(`${c.id} ${c.source ?? ""} ${c.desc ?? ""}`) }))
    .filter((c) => c.firstSeen && c.firstSeen < windowStart)
    .sort((a, b) => (a.firstSeen < b.firstSeen ? -1 : 1));
  return { columnCensus: census, doneCount: census.done ?? 0, stuck };
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The seven dates Sunday..Saturday of the week ending on the most recent Saturday on or before endDate. */
export function weekStripDates(endDate) {
  const end = new Date(`${endDate}T00:00:00Z`);
  const backToSat = (end.getUTCDay() + 1) % 7;
  const sat = new Date(end);
  sat.setUTCDate(end.getUTCDate() - backToSat);
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(sat);
    d.setUTCDate(sat.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** A Sunday..Saturday strip of per-day review activity. reviewsByDate maps a date to that
 *  day's review count (from its report summary.reviews); days with no report read as zero. */
export function buildWeekStrip(reviewsByDate, endDate) {
  return weekStripDates(endDate).map((date) => ({
    date,
    weekday: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()],
    reviews: reviewsByDate[date] ?? 0,
    hasReport: Object.prototype.hasOwnProperty.call(reviewsByDate, date),
  }));
}

/** The seven dates Sunday..Saturday of the calendar week containing endDate (the week ahead). */
export function currentWeekDates(endDate) {
  const end = new Date(`${endDate}T00:00:00Z`);
  const sun = new Date(end);
  sun.setUTCDate(end.getUTCDate() - end.getUTCDay());
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sun);
    d.setUTCDate(sun.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** A Sunday..Saturday plan skeleton for the week containing endDate; Wednesday is the update/review/article day. */
export function weekPlanSkeleton(endDate) {
  return currentWeekDates(endDate).map((date) => {
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, weekday: WEEKDAYS[wd], isReviewDay: wd === 3, tasks: [] };
  });
}

/** Assemble the deterministic retrospective. weekStrip/weekPlan/stateOfUnion/wins/misses/nextWeek are filled later. */
export function buildRetro({ reports, board, windowStart }) {
  const totals = aggregateTotals(reports);
  return {
    totals: Object.fromEntries(SUMMARY_KEYS.map((k) => [k, totals[k]])),
    perApp: perApp(reports),
    throughput: throughput(board, windowStart),
    recurringReflags: recurringReflags(reports),
    ratios: ratios(totals),
    weekStrip: [],
    weekPlan: [],
    stateOfUnion: "",
    wins: [], misses: [], nextWeek: [],
  };
}
