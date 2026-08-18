import Link from "next/link";
import { getRedis } from "@/lib/redis";

type TaxFile = { slug: string; name: string; title: string; bytes: number; type?: string };
type TaxPeriod = { year: string; period: string; files: TaxFile[] };
type StatusDeadline = { date: string; what: string; where: string };
type StatusPeriod = {
  id: string;
  folder: string;
  label: string;
  status: string;
  filedOn?: string;
  amendedOn?: string;
  lossPerReturn?: number;
  lossesCarriedForward?: number;
  note?: string;
};
type TaxStatus = {
  updated?: string;
  company?: { name?: string; number?: string; incorporated?: string };
  deadlines?: StatusDeadline[];
  periods?: StatusPeriod[];
  flags?: string[];
};
type TaxIndex = { generated: string; status?: TaxStatus; periods: TaxPeriod[] };

export const dynamic = "force-dynamic";

async function loadIndex(): Promise<TaxIndex | null> {
  const redis = getRedis();
  if (!redis) return null;
  return await redis.get<TaxIndex>("board:taxes:index");
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} kB`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(`${iso}T23:59:59Z`).getTime() - Date.now()) / 86_400_000);
}

function pounds(n: number | undefined): string {
  return n === undefined ? "" : `£${n.toLocaleString("en-GB")}`;
}

export default async function TaxesPage() {
  const index = await loadIndex();
  const periods = index?.periods ?? [];
  const status = index?.status;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Taxes</h1>
        <div className="flex gap-3 text-sm text-accent-green">
          <Link href="/board" className="underline">
            Board
          </Link>
          <Link href="/board/ledger" className="underline">
            Ledger
          </Link>
          <Link href="/board/reports" className="underline">
            Reports
          </Link>
          <Link href="/board/docs" className="underline">
            Plans
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {status?.company?.name ?? "Henceforth Bitcoin Limited"}, company{" "}
        {status?.company?.number ?? "13829963"} — the complete filing record: every
        filed document, the working papers, and the live pack. Stored only in
        Upstash, served only behind this sign-in.
      </p>

      {status?.deadlines && status.deadlines.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 border-b border-card-border pb-1 text-xl font-bold">Due next</h2>
          <ul className="flex flex-col gap-2">
            {status.deadlines.map((d) => {
              const days = daysUntil(d.date);
              return (
                <li key={d.date + d.what} className="flex items-baseline gap-3 text-sm">
                  <span className="w-[6.5rem] shrink-0 font-mono text-accent-warm">{d.date}</span>
                  <span className="text-foreground">{d.what}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">
                    {days >= 0 ? `${days} days` : `${-days} days overdue`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {status?.periods && status.periods.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 border-b border-card-border pb-1 text-xl font-bold">
            The periods and the losses chain
          </h2>
          <ul className="flex flex-col gap-3">
            {status.periods.map((p) => (
              <li key={p.id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-foreground">{p.label}</span>
                  <span
                    className={
                      p.status.includes("NOT")
                        ? "rounded bg-accent-warm/15 px-1.5 py-0.5 text-xs font-bold text-accent-warm"
                        : "rounded bg-accent-green/10 px-1.5 py-0.5 text-xs text-accent-green"
                    }
                  >
                    {p.status}
                  </span>
                  {p.lossPerReturn !== undefined && (
                    <span className="text-xs text-muted">
                      loss {pounds(p.lossPerReturn)} · carried forward{" "}
                      {pounds(p.lossesCarriedForward)}
                    </span>
                  )}
                </div>
                {p.note && <p className="mt-0.5 text-xs text-muted">{p.note}</p>}
              </li>
            ))}
          </ul>
          {status.flags && status.flags.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 border-l-2 border-accent-warm pl-3">
              {status.flags.map((f) => (
                <li key={f} className="text-xs text-muted">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {periods.length === 0 && (
        <p className="mt-10 text-muted">
          No filings published yet — run{" "}
          <code className="text-accent-green">
            node --env-file=.env.local scripts/board/publish-taxes.mjs
          </code>
          .
        </p>
      )}

      <div className="mt-10 flex flex-col gap-10">
        {periods.map((p) => (
          <section key={p.year}>
            <h2 className="mb-4 border-b border-card-border pb-1 text-xl font-bold">
              <span className="text-accent-warm">{p.period}</span>
              <span className="ml-3 text-xs font-normal text-muted">{p.year}</span>
            </h2>
            <ul className="flex flex-col gap-2.5">
              {p.files.map((f) => (
                <li key={f.slug} className="flex items-baseline gap-3">
                  <span className="w-[3.5rem] shrink-0 text-xs text-muted">{kb(f.bytes)}</span>
                  <Link
                    href={`/board/taxes/${p.year}/${f.slug}`}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    {f.title}
                  </Link>
                  <span className="hidden truncate text-xs text-muted sm:inline">{f.name}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
