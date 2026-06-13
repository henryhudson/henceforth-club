import type { DigestData, DigestSummary, YearCalendar } from './types'

// Pure, fs-free logic for the archive: projection, search, calendar layout.
// Kept separate from store.ts (which imports `fs`) so the client island can
// import these without pulling Node built-ins into the browser bundle.

/** Project a digest to the thin summary the client archive needs. */
export function toSummary(d: DigestData): DigestSummary {
  return {
    week: d.week,
    windowLabel: d.windowLabel,
    headline: d.headline ?? d.windowLabel,
    mode: d.mode,
    topics: (d.topTopics ?? []).map(t => t.heading),
    feature: d.feature?.title ?? null,
  }
}

/** Does this issue match a free-text query? Empty/whitespace matches all. */
export function matchesQuery(s: DigestSummary, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [s.headline, s.feature ?? '', ...s.topics].join(' ').toLowerCase().includes(needle)
}

/** ISO-8601 week (1–53) and its ISO week-year for a YYYY-MM-DD date.
 *  Parsed as UTC so the result is timezone-independent. */
function isoWeek(dateISO: string): { year: number; week: number } {
  const [y, m, d] = dateISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const day = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day) // shift to the week's Thursday
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: dt.getUTCFullYear(), week }
}

/** Number of ISO weeks (52 or 53) in a given ISO week-year. Dec 28 is always
 *  in the final ISO week, so its week number is the count. */
function isoWeeksInYear(year: number): number {
  return isoWeek(`${year}-12-28`).week
}

/** Lay published summaries out as one calendar per ISO week-year, newest year
 *  first, each with a fixed cell per week (absent weeks carry null). */
export function calendarByYear(summaries: readonly DigestSummary[]): YearCalendar[] {
  const byYear = new Map<number, Map<number, DigestSummary>>()
  for (const s of summaries) {
    const { year, week } = isoWeek(s.week)
    if (!byYear.has(year)) byYear.set(year, new Map())
    byYear.get(year)!.set(week, s)
  }
  return [...byYear.keys()]
    .sort((a, b) => b - a)
    .map(year => ({
      year,
      cells: Array.from({ length: isoWeeksInYear(year) }, (_, i) => ({
        weekIndex: i + 1,
        summary: byYear.get(year)!.get(i + 1) ?? null,
      })),
    }))
}
