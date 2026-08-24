import Link from "next/link";
import { notFound } from "next/navigation";
import { listDates, listWeeks, loadBoard, loadGardening, loadReport, loadWeek } from "@/lib/board-data";
import { gardenDiary, type DiaryEntry } from "@/lib/gardening";
import { asList, editionNumber } from "@/lib/report-helpers";
import PlanChecklist from "../PlanChecklist";
import MorningSheet, { openCards, weekAheadFrom } from "./_components/MorningSheet";
import type { BoardOpen, WeekAheadDay } from "./_components/MorningSheet";

export const dynamic = "force-dynamic";

const VERDICT: Record<string, { label: string; color: string }> = {
  agree: { label: "Confirmed", color: "text-accent-green" },
  reject: { label: "Rejected", color: "text-red-700" },
  abstain: { label: "Abstained", color: "text-muted" },
  "already-resolved": { label: "Already fixed", color: "text-accent" },
};

export default async function DailyEdition({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const report = await loadReport(date);
  if (!report) notFound();

  // The issue number, the way a paper carries one. Best-effort: a failure to
  // list editions must never take the page down.
  let issue: number | null = null;
  try {
    issue = editionNumber(await listDates(), date);
  } catch {
    issue = null;
  }

  // The week-ahead diary and the open board, both best-effort: a failure to
  // load either must never take the edition down.
  let weekAhead: WeekAheadDay[] = [];
  try {
    const weekKey = (await listWeeks()).find((w) => w <= date);
    weekAhead = weekAheadFrom(weekKey ? await loadWeek(weekKey) : null, date);
  } catch {
    weekAhead = [];
  }
  let boardOpen: BoardOpen | null = null;
  try {
    const board = await loadBoard();
    boardOpen = board ? openCards(board, date) : null;
  } catch {
    boardOpen = null;
  }
  // The garden diary: the content rhythms are excluded because the week
  // planner already carries them on the sheet.
  let garden: DiaryEntry[] = [];
  try {
    const g = await loadGardening();
    garden = g ? gardenDiary(g.jobs, date, ["Sci Fri", "Thinking Henceforth"]) : [];
  } catch {
    garden = [];
  }

  return (
    <main>
      {/* Web working copy first (print:hidden): the edition is for reading,
          this strip is for doing. Henry's 2026-08-24 process: orders on top. */}
      <div className="newspaper mx-auto max-w-4xl px-6 pt-6 print:hidden">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-foreground/60 pb-2 font-serif text-[12px]">
          <Link href="/board/reports" className="underline">Reports</Link>
          <Link href="/board" className="underline">Board</Link>
          <Link href="/board/week" className="underline">Week</Link>
          <a href={`/board/reports/${date}/pdf`} className="underline">PDF</a>
        </div>

        {report.plan && report.plan.items.length > 0 && (
          <section className="mt-4 border-2 border-foreground p-3">
            <h2 className="mb-1 text-center font-serif text-[12px] font-black uppercase tracking-[0.22em] text-foreground">
              Today&apos;s orders
            </h2>
            {report.plan.lead && (
              <p className="mb-2 text-center font-serif text-[13px] italic leading-snug text-muted">
                {report.plan.lead}
              </p>
            )}
            <PlanChecklist date={report.date} items={report.plan.items} />
            {report.plan.notToday && (
              <p className="mt-2 font-serif text-[12px] leading-snug text-muted">
                <span className="font-bold text-foreground/80">Deliberately not today.</span>{" "}
                {asList(report.plan.notToday)}
              </p>
            )}
          </section>
        )}

        {report.decisions && report.decisions.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-2 border-b-2 border-foreground/70 pb-0.5 font-serif text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
              Awaiting a decision
            </h2>
            <ul className="flex flex-col divide-y divide-card-border font-serif text-[13px]">
              {report.decisions.map((d) => (
                <li key={d.card} className="py-2 text-muted first:pt-0 last:pb-0">
                  <span className="mr-2 inline-block border border-accent/50 px-1.5 py-0.5 align-middle font-sans text-[9px] font-bold uppercase tracking-wide text-accent">
                    {d.proposal}
                  </span>
                  <span className="font-bold text-foreground">{d.card}</span> — {d.why}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* The paper itself — one A4 sheet on the newspaper measure. Print
          renders exactly this sheet; the working copy above is web-only. */}
      <div className="bg-[#dedbd4] py-6 print:bg-white print:py-0">
        <MorningSheet report={report} issue={issue} weekAhead={weekAhead} boardOpen={boardOpen} garden={garden} />
      </div>

      <div className="newspaper mx-auto max-w-4xl px-6 py-8 print:hidden">
        {report.plan?.decisions && (
          <p className="mt-3 font-serif text-[13px] leading-snug text-muted">
            <span className="font-bold text-foreground/80">Open decisions.</span>{" "}
            {asList(report.plan.decisions)}
          </p>
        )}

        <details className="mt-10">
          <summary className="cursor-pointer font-serif text-[13px] font-bold text-muted hover:text-foreground">
            Full verdicts — evidence, falsifications, recommendations
          </summary>

          <div className="mt-8 flex flex-col gap-10">
            {report.apps.map((app) => (
              <section key={app.app}>
                <h2 className="mb-4 border-b border-card-border pb-1 font-serif text-xl font-bold text-foreground">
                  {app.name}{" "}
                  <span className="text-xs font-normal text-muted">
                    {app.reviewFound ? `@ ${app.headSha}` : "no review today"}
                  </span>
                </h2>

                <div className="flex flex-col gap-6">
                  {app.findings.map((f) => {
                    const v = VERDICT[f.verdict] ?? VERDICT.abstain;
                    return (
                      <div key={f.refId}>
                        <p className="text-[11px] uppercase tracking-wide">
                          <span className={`font-bold ${v.color}`}>{v.label}</span>
                          <span className="text-muted/60">
                            {" · "}
                            {f.kind} · confidence {f.confidence}
                          </span>
                        </p>
                        <p className="mt-0.5 font-serif font-bold leading-snug text-foreground">{f.title}</p>
                        <p className="mt-1.5 font-serif text-[13px] leading-relaxed text-muted">
                          <span className="font-bold text-foreground/80">Evidence.</span> {f.evidence}
                        </p>
                        {f.falsification && (
                          <p className="mt-1 font-serif text-[13px] leading-relaxed text-muted">
                            <span className="font-bold text-foreground/80">Falsification.</span>{" "}
                            {f.falsification}
                          </p>
                        )}
                        {f.recommendation && (
                          <p className="mt-1 font-serif text-[13px] leading-relaxed text-muted">
                            <span className="font-bold text-foreground/80">Verdict.</span>{" "}
                            {f.recommendation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {app.findings.length === 0 && <p className="text-sm text-muted/60">No findings.</p>}
                </div>
              </section>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}
