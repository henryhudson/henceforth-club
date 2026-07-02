export type Edition = { type: "daily" | "weekly"; date: string; href: string };

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

export function editionIndex(dailyDates: string[], weekDates: string[]): Edition[] {
  const dailies: Edition[] = dailyDates.map((d) => ({ type: "daily", date: d, href: `/board/reports/${d}` }));
  const weeklies: Edition[] = weekDates.map((d) => ({ type: "weekly", date: d, href: `/board/reports/week/${d}` }));
  return [...dailies, ...weeklies].sort((a, b) =>
    a.date !== b.date ? (a.date > b.date ? -1 : 1) : a.type === "weekly" ? -1 : 1,
  );
}
