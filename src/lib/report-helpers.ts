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

export function editionIndex(dailyDates: string[], weekDates: string[]): Edition[] {
  const dailies: Edition[] = dailyDates.map((d) => ({ type: "daily", date: d, href: `/board/reports/${d}` }));
  const weeklies: Edition[] = weekDates.map((d) => ({ type: "weekly", date: d, href: `/board/reports/week/${d}` }));
  return [...dailies, ...weeklies].sort((a, b) =>
    a.date !== b.date ? (a.date > b.date ? -1 : 1) : a.type === "weekly" ? -1 : 1,
  );
}
