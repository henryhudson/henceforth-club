import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";

type Finding = {
  refId: string;
  title: string;
  kind: string;
  verdict: string;
  confidence: string;
  evidence: string;
  falsification?: string;
  recommendation?: string;
};
type AppReport = {
  app: string;
  name: string;
  headSha: string;
  reviewFound: boolean;
  findings: Finding[];
  note?: string;
};
type Report = {
  date: string;
  generatedAt: string;
  summary: Record<string, number>;
  apps: AppReport[];
};

const DIR = path.join(process.cwd(), "content/board/reports");

const VERDICT: Record<string, { label: string; cls: string }> = {
  agree: { label: "Confirmed", cls: "border-accent-green/40 bg-accent-green/10 text-accent-green" },
  reject: { label: "Rejected", cls: "border-red-500/40 bg-red-500/10 text-red-700" },
  abstain: { label: "Abstained", cls: "border-card-border bg-card-bg/60 text-muted" },
  "already-resolved": { label: "Already fixed", cls: "border-accent/50 bg-accent/10 text-foreground" },
};

async function listDates(): Promise<string[]> {
  try {
    const files = await fs.readdir(DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

async function loadReport(date: string): Promise<Report | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${date}.json`), "utf8")) as Report;
  } catch {
    return null;
  }
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
  const chip = (n: number | undefined, label: string) =>
    n ? (
      <span className="rounded-full border border-card-border bg-card-bg/60 px-3 py-1 text-sm text-muted">
        <span className="font-semibold text-foreground">{n}</span> {label}
      </span>
    ) : null;

  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Morning Report</h1>
          <Link href="/board" className="text-sm text-accent-green underline">
            Board →
          </Link>
        </div>
        <p className="mb-4 text-sm text-muted">
          {report.date} · generated {report.generatedAt}
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {chip(s.reviews, "reviews")}
          {chip(s.confirmed, "confirmed")}
          {chip(s.rejected, "rejected")}
          {chip(s.abstained, "abstained")}
          {chip(s.alreadyResolved, "already fixed")}
          {chip(s.skipped, "skipped")}
        </div>

        {dates.length > 1 && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">Archive</span>
            {dates.map((d) => (
              <Link
                key={d}
                href={`/board/report?date=${d}`}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  d === active
                    ? "border-accent-green bg-accent-green/10 text-accent-green"
                    : "border-card-border bg-card-bg/60 text-muted hover:text-foreground"
                }`}
              >
                {d}
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-8">
          {report.apps.map((app) => (
            <section key={app.app}>
              <div className="mb-3 flex items-baseline gap-2 border-b border-card-border pb-2">
                <h2 className="text-xl font-bold text-foreground">{app.name}</h2>
                {app.reviewFound ? (
                  <code className="text-xs text-muted">@ {app.headSha}</code>
                ) : (
                  <span className="text-xs text-muted">no review today</span>
                )}
              </div>
              <div className="flex flex-col gap-4">
                {app.findings.map((f) => {
                  const v = VERDICT[f.verdict] ?? VERDICT.abstain;
                  return (
                    <article
                      key={f.refId}
                      className="rounded-xl border border-card-border bg-card-bg/60 p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${v.cls}`}>
                          {v.label}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-muted">{f.kind}</span>
                        <span className="text-[11px] text-muted">confidence: {f.confidence}</span>
                      </div>
                      <p className="text-base font-semibold leading-snug text-foreground">{f.title}</p>
                      <dl className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
                        <Row label="Evidence" value={f.evidence} />
                        {f.falsification && <Row label="Falsification" value={f.falsification} />}
                        {f.recommendation && <Row label="Verdict" value={f.recommendation} />}
                      </dl>
                    </article>
                  );
                })}
                {app.findings.length === 0 && (
                  <p className="text-sm text-muted/60">No findings.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted/70">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
