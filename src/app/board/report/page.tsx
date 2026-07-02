import Link from "next/link";
import PlanChecklist from "@/app/board/reports/PlanChecklist";
import { listDates, loadReport } from "@/lib/board-data";

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

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dates = await listDates();
  const active = date && dates.includes(date) ? date : dates[0];
  const report = active ? await loadReport(active) : null;

  if (!report) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        No morning report yet — run <code className="text-accent-green">/hh</code> to generate one.{" "}
        <Link href="/board" className="text-accent-green underline">
          Back to board
        </Link>
      </main>
    );
  }

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
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Morning Report</h1>
        <div className="flex gap-3 text-sm text-accent-green">
          <Link href="/board" className="underline">
            Board
          </Link>
          <Link href="/board/docs" className="underline">
            Plans &amp; specs
          </Link>
          <Link href="/board/week" className="underline">This week</Link>
        </div>
      </div>
      <p className="text-sm text-muted">
        {report.date} · generated {report.generatedAt}
      </p>
      <p className="mt-3 text-foreground">
        <span className="font-semibold">{s.reviews} reviews</span> adjudicated
        {parts.length > 0 && <> — {parts.join(", ")}</>}.
      </p>

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

      {report.appStore && (
        <section className="mt-8">
          <h2 className="mb-1 border-b border-card-border pb-1 text-xl font-bold text-foreground">
            App Store cadence{" "}
            <span className="text-sm font-normal text-muted">— {report.appStore.shipDay}</span>
          </h2>
          <p className="mb-3 mt-2 text-sm italic leading-relaxed text-muted/80">
            {report.appStore.rule}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted/70">
                  <th className="py-1 pr-3 font-semibold">App</th>
                  <th className="py-1 pr-3 font-semibold">Status</th>
                  <th className="py-1 pr-3 font-semibold">Live</th>
                  <th className="py-1 pr-3 font-semibold">Days</th>
                  <th className="py-1 pr-3 font-semibold">Ready but unshipped</th>
                  <th className="py-1 font-semibold">Ship blocker</th>
                </tr>
              </thead>
              <tbody>
                {report.appStore.apps.map((a) => (
                  <tr key={a.app} className="border-t border-card-border align-top">
                    <td className="py-2 pr-3 font-semibold text-foreground">{a.app}</td>
                    <td className={`py-2 pr-3 font-semibold ${statusColor(a.status)}`}>{a.status}</td>
                    <td className="py-2 pr-3 text-muted">{a.version}</td>
                    <td className="py-2 pr-3 text-muted">{a.daysSince ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted">{a.readyToShip}</td>
                    <td className="py-2 text-muted">{a.blocker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dates.length > 1 && (
        <p className="mt-3 text-sm text-muted">
          Archive:{" "}
          {dates.map((d, i) => (
            <span key={d}>
              {i > 0 && " · "}
              <Link
                href={`/board/report?date=${d}`}
                className={d === active ? "font-semibold text-foreground" : "underline hover:text-foreground"}
              >
                {d}
              </Link>
            </span>
          ))}
        </p>
      )}

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

      {report.plan && report.plan.items.length > 0 && (
        <section className="mt-14">
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
              {report.plan.notToday}
            </p>
          )}
          {report.plan.decisions && (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground/80">Open decisions.</span>{" "}
              {report.plan.decisions}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
