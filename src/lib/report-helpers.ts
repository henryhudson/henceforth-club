export type Edition = { type: "daily" | "weekly"; date: string; href: string };

/** English ordinal for a day of the month — 1st, 2nd, 3rd, 4th … 11th, 21st.
 *  The teens are the exception that catches naive implementations: 11, 12 and
 *  13 take "th" despite ending in 1, 2 and 3. */
function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** An edition's date as Henry reads it aloud — "Tuesday 28th of July 2026".
 *  Pinned to UTC so the day name cannot shift with the renderer's timezone: the
 *  print edition renders headless and Vercel runs in UTC, west of which an
 *  unpinned formatter reads midnight as the previous day. */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
      .formatToParts(d)
      .find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${ordinal(Number(part("day")))} of ${part("month")} ${part("year")}`;
}

/** The issue number a paper carries on its dateline: this edition's position in
 *  the run, oldest first, counting from 1. Returns null when the date is not in
 *  the list, so a masthead never prints a confident wrong number. */
export function editionNumber(dates: string[], date: string): number | null {
  const i = [...new Set(dates)].sort().indexOf(date);
  return i < 0 ? null : i + 1;
}

export function verdictLine(findings: { verdict: string }[]): string {
  if (findings.length === 0) return "no findings";
  const counts = { confirmed: 0, rejected: 0, abstained: 0, alreadyFixed: 0 };
  for (const f of findings) {
    if (f.verdict === "agree") counts.confirmed++;
    else if (f.verdict === "reject") counts.rejected++;
    else if (f.verdict === "already-resolved") counts.alreadyFixed++;
    else counts.abstained++;
  }
  const parts: string[] = [];
  if (counts.confirmed) parts.push(`${counts.confirmed} confirmed`);
  if (counts.rejected) parts.push(`${counts.rejected} rejected`);
  if (counts.abstained) parts.push(`${counts.abstained} abstained`);
  if (counts.alreadyFixed) parts.push(`${counts.alreadyFixed} already fixed`);
  return parts.join(" · ");
}

/** Older reports store notToday/decisions as one string; newer ones as a list. */
export function asList(v?: string | string[]): string {
  return Array.isArray(v) ? v.join(" · ") : (v ?? "");
}

export type ReachYesterday = { date: string | null; count: number | null };

/** One human line for an app's reach. Honest about the lag: a null yesterday
 *  means Apple has not processed the day yet — it must never render as zero. */
export function reachAppLine(
  name: string,
  yesterday: ReachYesterday,
  week?: Record<string, number>,
  rating?: { average: number | null; count: number },
): string {
  const parts = [
    yesterday.count == null
      ? "yesterday not yet processed"
      : `${yesterday.count} download${yesterday.count === 1 ? "" : "s"} yesterday`,
  ];
  if (week) {
    const total = Object.values(week).reduce((a, b) => a + b, 0);
    parts.push(`${total} in the window`);
  }
  if (rating && rating.count > 0 && rating.average != null) {
    parts.push(`rating ${rating.average.toFixed(1)} of 5 from ${rating.count}`);
  }
  return `${name} — ${parts.join(" · ")}`;
}

export type ShippedCard = { id: string; title: string };

/** Kanban cards finished on each of the given days, keyed by day. A card counts
 *  for the day it was marked done — falling back to the last column move for the
 *  cards that predate `doneAt`. */
export function shippedByDay(
  cards: { id: string; title: string; col: string; movedAt?: string; doneAt?: string }[],
  days: string[],
): Record<string, ShippedCard[]> {
  const wanted = new Set(days);
  const out: Record<string, ShippedCard[]> = {};
  for (const c of cards) {
    const day = (c.doneAt || c.movedAt || "").slice(0, 10);
    if (c.col !== "done" || !wanted.has(day)) continue;
    (out[day] = out[day] || []).push({ id: c.id, title: c.title });
  }
  return out;
}

/** Agate cell for a day's downloads. An unprocessed day (missing or null)
 *  is an em dash — never a zero. A real zero prints as "0". */
export function reachCell(count: number | null | undefined): string {
  return count == null ? "—" : String(count);
}

/** Polyline points for an agate sparkline. Nulls keep their x slot but are
 *  not plotted. Returns null when fewer than two numbers exist — a single
 *  point is not a series, and a blank row stays blank. */
export function sparkPoints(
  values: (number | null | undefined)[],
  width = 42,
  height = 10,
): string | null {
  if (values.length === 0) return null;
  const plotted = values
    .map((v, i) => (v == null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p != null);
  if (plotted.length < 2) return null;
  const min = Math.min(0, ...plotted.map((p) => p.v));
  const max = Math.max(...plotted.map((p) => p.v));
  const span = max - min || 1;
  const last = Math.max(values.length - 1, 1);
  const pad = 0.5;
  return plotted
    .map(({ i, v }) => {
      const x = (i / last) * width;
      const y = height - pad - ((v - min) / span) * (height - 2 * pad);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/** True when this cell is a numeric high for the row. Ties all mark.
 *  An all-unprocessed row has no high. */
export function isRowHigh(
  values: (number | null | undefined)[],
  index: number,
): boolean {
  const v = values[index];
  if (v == null) return false;
  const nums = values.filter((n): n is number => n != null);
  if (nums.length === 0) return false;
  return v === Math.max(...nums);
}

export function editionIndex(dailyDates: string[], weekDates: string[]): Edition[] {
  const dailies: Edition[] = dailyDates.map((d) => ({ type: "daily", date: d, href: `/board/reports/${d}` }));
  const weeklies: Edition[] = weekDates.map((d) => ({ type: "weekly", date: d, href: `/board/reports/week/${d}` }));
  return [...dailies, ...weeklies].sort((a, b) =>
    a.date !== b.date ? (a.date > b.date ? -1 : 1) : a.type === "weekly" ? -1 : 1,
  );
}
