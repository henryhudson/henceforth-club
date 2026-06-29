import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { getRedis } from "@/lib/redis";
import PlanChecklist, { type PlanItem } from "./PlanChecklist";

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
type Plan = {
  lead?: string;
  note?: string;
  items: PlanItem[];
  notToday?: string;
  decisions?: string;
};
type Report = {
  date: string;
  generatedAt: string;
  summary: Record<string, number>;
  apps: AppReport[];
  plan?: Plan;
};

const DIR = path.join(process.cwd(), "content/board/reports");

export const dynamic = "force-dynamic";

const VERDICT: Record<string, { label: string; color: string }> = {
  agree: { label: "Confirmed", color: "text-accent-green" },
  reject: { label: "Rejected", color: "text-red-700" },
  abstain: { label: "Abstained", color: "text-muted" },
  "already-resolved": { label: "Already fixed", color: "text-accent" },
};

async function listDates(): Promise<string[]> {
  const redis = getRedis();
  if (redis) {
    const dates = await redis.smembers("board:report:dates");
    if (dates && dates.length) return [...dates].sort().reverse();
  }
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
  const redis = getRedis();
  if (redis) {
    const r = await redis.get<Report>(`board:report:${date}`);
    if (r) return r;
  }
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
