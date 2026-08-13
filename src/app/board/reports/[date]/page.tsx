import Link from "next/link";
import { notFound } from "next/navigation";
import { listDates, loadReport } from "@/lib/board-data";
import { asList, editionNumber, longDate, reachAppLine, verdictLine } from "@/lib/report-helpers";
import PlanChecklist from "../PlanChecklist";

export const dynamic = "force-dynamic";

const VERDICT: Record<string, { label: string; color: string }> = {
  agree: { label: "Confirmed", color: "text-accent-green" },
  reject: { label: "Rejected", color: "text-red-700" },
  abstain: { label: "Abstained", color: "text-muted" },
  "already-resolved": { label: "Already fixed", color: "text-accent" },
};

function statusColor(status: string): string {
  if (status === "live") return "text-accent-green";
  if (status.startsWith("rejected")) return "text-red-700";
  return "text-accent";
}
function tagChipColor(tag: string): string {
  const t = tag.toLowerCase();
  if (t === "resolved") return "border-accent-green/50 text-accent-green";
  if (["defect", "security", "data-loss", "bug"].includes(t)) return "border-red-700/60 text-red-500";
  return "border-accent/50 text-accent";
}

/** A standing column head — the small letterspaced rule-and-label a newspaper
 *  puts above every standing section. */
function Rubric({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 border-b-2 border-foreground/70 pb-0.5 font-serif text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
      {children}
    </h2>
  );
}

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

  const s = report.summary;
  const parts: string[] = [];
  if (s.confirmed) parts.push(`${s.confirmed} confirmed`);
  if (s.rejected) parts.push(`${s.rejected} rejected`);
  if (s.abstained) parts.push(`${s.abstained} abstained`);
  if (s.alreadyResolved) parts.push(`${s.alreadyResolved} already fixed`);
  if (s.skipped) parts.push(`${s.skipped} skipped`);

  const sections = report.article?.sections ?? [];

  return (
    <main className="newspaper mx-auto max-w-4xl px-6 py-10">
      <p className="pb-1.5 text-center font-serif text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
        {longDate(report.date)}
      </p>
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="border-y-4 border-double border-foreground py-3 text-center">
        <p className="font-serif text-[10px] uppercase tracking-[0.35em] text-muted">
          Deck of Cards · Henceforth · The Hansard · henceforth.club
        </p>
        <h1 className="mt-1 font-serif text-4xl font-black uppercase tracking-[0.12em] text-foreground sm:text-5xl">
          The Morning Edition
        </h1>
        <p className="mt-1 font-serif text-[11px] italic text-muted">
          The state of the four, and what would most improve each today
        </p>
      </header>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-foreground/60 py-1.5 font-serif text-[11px] uppercase tracking-[0.12em] text-muted">
        <span className="print:hidden flex gap-3 normal-case tracking-normal text-accent-green">
          <Link href="/board/reports" className="underline">Reports</Link>
          <Link href="/board" className="underline">Board</Link>
          <Link href="/board/week" className="underline">Week</Link>
          <a href={`/board/reports/${date}/pdf`} className="underline">PDF</a>
        </span>
        <span>{issue != null ? `No. ${issue}` : " "}</span>
      </div>

      {/* ── Stop press: the do-now band, above the fold ──────────────────── */}
      {report.emergencies && report.emergencies.length > 0 && (
        <section className="mt-5 border-2 border-foreground bg-card-bg/60 p-3">
          <h2 className="mb-2 font-serif text-[11px] font-black uppercase tracking-[0.2em] text-accent">
            Stop press — do these first
          </h2>
          <ul className="flex flex-col divide-y divide-card-border">
            {report.emergencies.map((e, i) => (
              <li key={i} className="py-2 first:pt-0 last:pb-0">
                <p className="font-serif font-bold leading-snug text-foreground">
                  <span
                    className={`mr-2 inline-block border px-1.5 py-0.5 align-middle font-sans text-[9px] font-bold uppercase tracking-wide ${tagChipColor(e.tag)}`}
                  >
                    {e.tag}
                  </span>
                  {e.title}
                </p>
                <p className="mt-1 font-serif text-[13px] leading-snug text-muted">{e.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {report.emergencies && report.emergencies.length === 0 && (
        <p className="mt-5 border border-accent-green/50 bg-accent-green/5 p-2 text-center font-serif text-[11px] font-bold uppercase tracking-[0.2em] text-accent-green">
          Nothing on fire — clear to build
        </p>
      )}

      {/* ── The lead ─────────────────────────────────────────────────────── */}
      {report.article && (
        <article className="mt-6">
          <h2 className="text-center font-serif text-3xl font-black leading-[1.1] tracking-tight text-foreground sm:text-4xl">
            {report.article.headline}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center font-serif text-[15px] italic leading-relaxed text-foreground/90">
            {report.article.lede}
          </p>

          <div className="mt-6 border-t border-foreground/30 pt-4 sm:columns-2 sm:gap-7 sm:[column-rule:1px_solid_var(--card-border)]">
            {sections.map((sec, si) => (
              <section key={sec.heading} className="mb-4 break-inside-avoid-column">
                <h3 className="font-serif text-[13px] font-black uppercase tracking-[0.08em] text-foreground">
                  {sec.heading}
                </h3>
                {sec.body.split("\n\n").map((p, i) => (
                  <p
                    key={i}
                    className={`mt-1.5 text-justify font-serif text-[13px] leading-[1.45] text-muted hyphens-auto ${
                      si === 0 && i === 0
                        ? "first-letter:float-left first-letter:mr-1.5 first-letter:mt-1 first-letter:font-serif first-letter:text-[38px] first-letter:font-black first-letter:leading-[0.8] first-letter:text-foreground"
                        : ""
                    }`}
                  >
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
      )}

      {/* ── Today's orders: the plan, on the page rather than below it ───── */}
      {report.plan && report.plan.items.length > 0 && (
        <section className="mt-7 border-2 border-foreground p-3">
          <h2 className="mb-1 text-center font-serif text-[12px] font-black uppercase tracking-[0.22em] text-foreground">
            Today&apos;s orders
          </h2>
          {report.plan.lead && (
            <p className="mb-2 text-center font-serif text-[13px] italic leading-snug text-muted">
              {report.plan.lead}
            </p>
          )}
          <PlanChecklist date={report.date} items={report.plan.items} />
          {report.plan.note && (
            <p className="mt-2 font-serif text-[12px] italic leading-snug text-muted/80 print:hidden">
              {report.plan.note}
            </p>
          )}
          {report.plan.notToday && (
            <p className="mt-2 font-serif text-[12px] leading-snug text-muted">
              <span className="font-bold text-foreground/80">Deliberately not today.</span>{" "}
              {asList(report.plan.notToday)}
            </p>
          )}
        </section>
      )}

      {/* ── Standing columns: numbers, diary, the desk ───────────────────── */}
      <div className="mt-7 grid gap-6 sm:grid-cols-3">
        {report.reach && (
          <section>
            <Rubric>By the numbers</Rubric>
            <ul className="flex flex-col gap-1 font-serif text-[12px] leading-snug text-muted">
              {report.reach.perApp.map((a) => (
                <li key={a.app}>{reachAppLine(a.app, a.yesterday, a.week, a.rating)}</li>
              ))}
              {report.reach.site && (
                <li>
                  site — {report.reach.site.yesterday ?? 0} views yesterday · {report.reach.site.week} in the
                  window · {report.reach.site.total} all-time
                </li>
              )}
            </ul>
            {report.reach.dataThrough && (
              <p className="mt-1 font-serif text-[10px] italic text-muted/60">
                App Store data through {report.reach.dataThrough} — Apple lags about a day.
              </p>
            )}
          </section>
        )}

        {report.appStore && (
          <section>
            <Rubric>Ship diary</Rubric>
            <p className="mb-1 font-serif text-[10px] uppercase tracking-wider text-accent">
              {report.appStore.shipDay}
            </p>
            <ul className="flex flex-col gap-1 font-serif text-[12px] leading-snug">
              {report.appStore.apps.map((a) => (
                <li key={a.app} className="text-muted">
                  <span className="font-bold text-foreground">{a.app}</span>
                  {" — "}<span className={statusColor(a.status)}>{a.status}</span>
                  {" · "}{a.version}
                  {a.daysSince != null && <> · {a.daysSince}d</>}
                  {" · "}{a.blocker}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <Rubric>From the desk</Rubric>
          <ul className="flex flex-col gap-1 font-serif text-[12px] leading-snug">
            {report.apps.map((app) => (
              <li key={app.app} className="text-muted">
                <span className="font-bold text-foreground">{app.name}</span>
                {app.reviewFound ? (
                  <> @ {app.headSha.slice(0, 7)} — {verdictLine(app.findings)}</>
                ) : (
                  <> — no review today</>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 font-serif text-[10px] italic text-muted/60">
            {s.reviews} reviews adjudicated{parts.length > 0 && <> — {parts.join(", ")}</>}.
          </p>
        </section>
      </div>

      {/* ── Web-only matter ──────────────────────────────────────────────── */}
      {report.decisions && report.decisions.length > 0 && (
        <section className="mt-8 print:hidden">
          <Rubric>Awaiting a decision</Rubric>
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

      {report.plan?.decisions && (
        <p className="mt-3 font-serif text-[13px] leading-snug text-muted print:hidden">
          <span className="font-bold text-foreground/80">Open decisions.</span>{" "}
          {asList(report.plan.decisions)}
        </p>
      )}

      <details className="mt-10 print:hidden">
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
    </main>
  );
}
