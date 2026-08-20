// The Morning Edition's garden diary (Henry, 2026-08-20: "include the
// gardening on my morning edition — it can be a sort of calendar as well").
// The parsed schedule arrives via Upstash `board:gardening` (published by
// scripts/board/publish.mjs from ~/Gardening/schedule.md); this module is the
// pure selection the sheet renders.

export type GardeningJob = { section: string; date: string; label: string | null; done: boolean };
export type Gardening = { updated: string; jobs: GardeningJob[] };

export type DiaryEntry = { section: string; date: string; overdue: boolean };

/** Each section's NEXT undone job, oldest first, overdue flagged — an almanac
 *  line per rhythm. `exclude` names sections the sheet already carries
 *  elsewhere (the content rhythms render via the week planner). */
export function gardenDiary(jobs: GardeningJob[], today: string, exclude: string[] = []): DiaryEntry[] {
  const bySection = new Map<string, GardeningJob>();
  for (const j of jobs) {
    if (j.done) continue;
    if (exclude.some((e) => j.section.startsWith(e))) continue;
    const cur = bySection.get(j.section);
    if (!cur || j.date < cur.date) bySection.set(j.section, j);
  }
  return [...bySection.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((j) => ({ section: j.section, date: j.date, overdue: j.date < today }));
}
