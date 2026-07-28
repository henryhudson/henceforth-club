import Link from "next/link";
import { notFound } from "next/navigation";
import { loadReport } from "@/lib/board-data";
import { asList, longDate, reachAppLine, verdictLine } from "@/lib/report-helpers";
import PlanChecklist from "../PlanChecklist";

export const dynamic = "force-dynamic";

const VERDICT: Record<string, { label: string; color: string }> = {
  agree: { label: "Confirmed", color: "text-accent-green" },
  reject: { label: "Rejected", color: "text-red-700" },
  abstain: { label: "Abstained", color: "text-muted" },
  "already-resolved": { label: "Already fixed", color: "text-accent" },
};

// Emergency chip + cadence status colours, mapped onto the site's theme tokens.
function statusColor(status: string): string {
  if (status === "live") return "text-accent-green";
  if (status.startsWith("rejected")) return "text-red-700";
  return "text-accent"; // not-yet-shipped, etc.
}
function tagChipColor(tag: string): string {
  const t = tag.toLowerCase();
  if (t === "resolved") return "border-accent-green/50 text-accent-green";
  if (["defect", "security", "data-loss", "bug"].includes(t)) return "border-red-700/60 text-red-500";
  return "border-accent/50 text-accent"; // ship, deadline, better-way
}

export default async function DailyEdition({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const report = await loadReport(date);
  if (!report) notFound();

  const s = report.summary;
  const parts: string[] = [];
  if (s.confirmed) parts.push(`${s.confirmed} confirmed`);
  if (s.rejected) parts.push(`${s.rejected} rejected`);
  if (s.abstained) parts.push(`${s.abstained} abstained`);
  if (s.alreadyResolved) parts.push(`${s.alreadyResolved} already fixed`);
  if (s.skipped) parts.push(`${s.skipped} skipped`);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Daily Report</h1>
        <div className="flex gap-3 text-sm text-accent-green print:hidden">
          <Link href="/board/reports" className="underline">Reports</Link>
          <Link href="/board" className="underline">Board</Link>
          <Link href="/board/week" className="underline">Week</Link>
          <a href={`/board/reports/${date}/pdf`} className="underline print:hidden">PDF</a>
        </div>
      </div>
      <p className="text-sm text-muted">{longDate(report.date)} · generated {report.generatedAt}</p>

      {report.article && (
        <article className="mt-8">
          <h2 className="text-2xl font-bold leading-tight text-foreground">{report.article.headline}</h2>
          <p className="mt-3 text-base leading-relaxed text-foreground/90">{report.article.lede}</p>
          {report.article.sections.map((sec) => (
            <section key={sec.heading} className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent-green">{sec.heading}</h3>
              {sec.body.split("\n\n").map((p, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed text-muted">{p}</p>
              ))}
            </section>
          ))}
        </article>
      )}

      {report.reach && (
        <section className="mt-8">
          <h2 className="mb-2 border-b border-card-border pb-1 text-xl font-bold text-foreground">Reach</h2>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {report.reach.perApp.map((a) => (
              <li key={a.app}>{reachAppLine(a.app, a.yesterday, a.week, a.rating)}</li>
            ))}
            {report.reach.site && (
              <li>
                site — {report.reach.site.yesterday ?? 0} page views yesterday · {report.reach.site.week} in the
                window · {report.reach.site.total} all-time
              </li>
            )}
          </ul>
          {report.reach.dataThrough && (
            <p className="mt-1 text-xs text-muted/60">
              App Store data through {report.reach.dataThrough} — Apple lags about a day.
            </p>
          )}
        </section>
      )}

      {report.emergencies && (
        <section
          className={`mt-6 rounded-md border-2 p-4 ${
            report.emergencies.length === 0
              ? "border-accent-green/40 bg-accent-green/5"
              : "border-accent/40 bg-accent/5"
          }`}
        >
          <h2
            className={`mb-2 text-xs font-bold uppercase tracking-wider ${
              report.emergencies.length === 0 ? "text-accent-green" : "text-accent"
            }`}
          >
            {report.emergencies.length === 0
              ? "Nothing on fire — clear to build"
              : "⚠ Do now — emergency actions"}
          </h2>
          {report.emergencies.length > 0 && (
            <ul className="flex flex-col divide-y divide-card-border">
              {report.emergencies.map((e, i) => (
                <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="font-semibold leading-snug text-foreground">
                    <span
                      className={`mr-2 inline-block rounded border px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide ${tagChipColor(
                        e.tag,
                      )}`}
                    >
                      {e.tag}
                    </span>
                    {e.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{e.why}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {report.decisions && report.decisions.length > 0 && (
        <section className="mt-8 print:hidden">
          <h2 className="mb-2 border-b border-card-border pb-1 text-xl font-bold text-foreground">
            This morning&apos;s decisions
          </h2>
          <ul className="flex flex-col divide-y divide-card-border text-sm">
            {report.decisions.map((d) => (
              <li key={d.card} className="py-2 text-muted first:pt-0 last:pb-0">
                <span className="mr-2 inline-block rounded border border-accent/50 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-accent">
                  {d.proposal}
                </span>
                <span className="font-semibold text-foreground">{d.card}</span> — {d.why}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.plan && report.plan.items.length > 0 && (
        <section className="mt-14 print:hidden">
          <h2 className="mb-1 border-b border-card-border pb-1 text-xl font-bold text-foreground">
            Plan of action
          </h2>
          {report.plan.lead && (
            <p className="mb-2 mt-3 text-sm leading-relaxed text-muted">{report.plan.lead}</p>
          )}
          {report.plan.note && (
            <p className="mb-5 text-sm italic leading-relaxed text-muted/80">{report.plan.note}</p>
          )}
          <PlanChecklist date={report.date} items={report.plan.items} />
          {report.plan.notToday && (
            <p className="mt-8 text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground/80">Deliberately not today.</span>{" "}
              {asList(report.plan.notToday)}
            </p>
          )}
          {report.plan.decisions && (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground/80">Open decisions.</span>{" "}
              {asList(report.plan.decisions)}
            </p>
          )}
        </section>
      )}

      {report.appStore && (
        <section className="mt-8">
          <h2 className="mb-2 border-b border-card-border pb-1 text-xl font-bold text-foreground">
            Ship cadence <span className="text-sm font-normal text-muted">— {report.appStore.shipDay}</span>
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {report.appStore.apps.map((a) => (
              <li key={a.app} className="text-muted">
                <span className="font-semibold text-foreground">{a.app}</span>
                {" — "}<span className={statusColor(a.status)}>{a.status}</span>
                {" · "}{a.version}
                {a.daysSince != null && <> · {a.daysSince}d</>}
                {" · "}{a.blocker}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 border-b border-card-border pb-1 text-xl font-bold text-foreground">Verdicts</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {report.apps.map((app) => (
            <li key={app.app} className="text-muted">
              <span className="font-semibold text-foreground">{app.name}</span>
              {app.reviewFound ? <> @ {app.headSha.slice(0, 7)} — {verdictLine(app.findings)}</> : <> — no review today</>}
            </li>
          ))}
        </ul>
      </section>

      <details className="mt-10 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground">
          Full verdicts — evidence, falsifications, recommendations
        </summary>

        <p className="mt-4 text-foreground">
          <span className="font-semibold">{s.reviews} reviews</span> adjudicated
          {parts.length > 0 && <> — {parts.join(", ")}</>}.
        </p>

        <div className="mt-10 flex flex-col gap-10">
          {report.apps.map((app) => (
            <section key={app.app}>
              <h2 className="mb-4 border-b border-card-border pb-1 text-xl font-bold text-foreground">
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
                      <p className="mt-0.5 font-semibold leading-snug text-foreground">{f.title}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">
                        <span className="font-semibold text-foreground/80">Evidence.</span> {f.evidence}
                      </p>
                      {f.falsification && (
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          <span className="font-semibold text-foreground/80">Falsification.</span>{" "}
                          {f.falsification}
                        </p>
                      )}
                      {f.recommendation && (
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          <span className="font-semibold text-foreground/80">Verdict.</span>{" "}
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
