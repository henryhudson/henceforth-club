import Link from "next/link";
import { getRedis } from "@/lib/redis";

type TaxFile = { slug: string; name: string; title: string; bytes: number };
type TaxPeriod = { year: string; period: string; files: TaxFile[] };
type TaxIndex = { generated: string; periods: TaxPeriod[] };

export const dynamic = "force-dynamic";

async function loadIndex(): Promise<TaxIndex | null> {
  const redis = getRedis();
  if (!redis) return null;
  return await redis.get<TaxIndex>("board:taxes:index");
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} kB`;
}

export default async function TaxesPage() {
  const index = await loadIndex();
  const periods = index?.periods ?? [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Taxes</h1>
        <div className="flex gap-3 text-sm text-accent-green">
          <Link href="/board" className="underline">
            Board
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
        Henceforth Bitcoin Limited — the accountant&apos;s filing pack for each
        accounting period. Stored only in Upstash, served only behind this
        sign-in.
      </p>

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
              <span className="text-accent-warm">{p.year}</span>
              <span className="ml-3 text-xs font-normal text-muted">
                accounting period {p.period}
              </span>
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
