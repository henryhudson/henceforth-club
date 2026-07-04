import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWeek } from "@/lib/board-data";

export const dynamic = "force-dynamic";

const ACCENT: Record<string, string> = { henceforth: "text-accent-warm", hansard: "text-accent-green", deck: "text-accent" };
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`);

export default async function WeeklyEdition({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const w = await loadWeek(date);
  if (!w) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 print-weekly">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Weekly Report</h1>
        <div className="flex gap-3 text-sm text-accent-green print:hidden">
          <Link href="/board/reports" className="underline">Reports</Link>
          <Link href="/board" className="underline">Board</Link>
          <Link href="/board/week" className="underline">Week</Link>
          <a href={`/board/reports/week/${date}/pdf`} className="underline print:hidden">PDF</a>
        </div>
      </div>
      <p className="text-muted">Week of {w.weekOf} → {w.weekEnd} · {w.daysCovered.length} review days</p>

      {w.retro.stateOfUnion && (
        <p className="mt-4 border-l-2 border-accent-green/50 pl-4 text-lg leading-relaxed text-foreground">{w.retro.stateOfUnion}</p>
      )}

      {/* sales strip — one line per app */}
      <section className="mt-6">
        <h2 className="mb-2 border-b border-card-border pb-1 text-xl font-bold text-foreground">Sales</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {w.sales.perApp.map((a) => (
            <li key={a.app} className="text-muted">
              <span className="font-semibold text-foreground">{a.name}</span>
              {" — "}{a.units.thisWeek} downloads ({pct(a.units.deltaPct)} on last week)
            </li>
          ))}
        </ul>
        {w.sales.note && <p className="mt-2 text-sm text-muted">{w.sales.note}</p>}
      </section>

      {/* accomplished vs planned — per day, done tasks ticked */}
      <section className="mt-8">
        <h2 className="mb-2 border-b border-card-border pb-1 text-xl font-bold text-foreground">Accomplished vs planned</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {w.retro.weekPlan.filter((d) => d.tasks.length > 0).map((d) => (
            <li key={d.date}>
              <span className="font-semibold text-foreground">{d.weekday} {d.date.slice(5)}</span>
              <ul className="mt-0.5 flex flex-col gap-0.5 pl-4">
                {d.tasks.map((t, i) => {
                  const task = typeof t === "string" ? { label: t, done: false } : t;
                  return (
                    <li key={i} className={task.done ? "text-muted line-through" : "text-muted"}>
                      {task.done ? "✓ " : "· "}{task.label}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <details className="mt-10 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground">
          Full week detail — week strip, wins &amp; misses, stuck work, re-flags, next week, sales drivers, app state
        </summary>

        <div className="mt-4">
          {w.retro.weekStrip?.length === 7 && (
            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {w.retro.weekStrip.map((d) => (
                <div key={d.date} className={`rounded-md border px-1 py-2 ${d.reviews > 0 ? "border-accent-green/40 bg-accent-green/10" : "border-card-border bg-card-bg/30"}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{d.weekday}</div>
                  <div className="mt-0.5 text-lg font-bold text-foreground">{d.reviews > 0 ? d.reviews : "·"}</div>
                  <div className="text-[10px] text-muted">{Number(d.date.slice(8))}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(w.retro.totals).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-card-border bg-card-bg/40 px-3 py-2">
                <div className="text-2xl font-bold text-foreground">{v}</div>
                <div className="text-xs uppercase tracking-wide text-muted">{k}</div>
              </div>
            ))}
          </div>

          {(w.retro.wins.length > 0 || w.retro.misses.length > 0) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-lg font-bold text-accent-green">Wins</h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">{w.retro.wins.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-accent-orange">Misses</h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">{w.retro.misses.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            </div>
          )}

          {w.retro.throughput.stuck.length > 0 && (
            <>
              <h3 className="mt-6 text-lg font-bold">Stuck this week</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {w.retro.throughput.stuck.map((s) => (
                  <li key={s.id}><span className={`font-bold ${ACCENT[s.app] ?? "text-muted"}`}>{s.app}</span> {s.title} — in {s.col} since {s.firstSeen}</li>
                ))}
              </ul>
            </>
          )}

          {w.retro.recurringReflags.length > 0 && (
            <>
              <h3 className="mt-6 text-lg font-bold">Recurring re-flags — the noise to fix</h3>
              <ul className="mt-2 space-y-1">
                {w.retro.recurringReflags.map((r) => (
                  <li key={`${r.app}:${r.signature}`} className="text-sm">
                    <span className={`font-bold ${ACCENT[r.app] ?? "text-muted"}`}>{r.app}</span>{" "}
                    {r.title} — <span className="text-muted">flagged {r.timesFlagged}× since {r.firstSeen} ({r.status})</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {w.retro.nextWeek.length > 0 && (
            <>
              <h3 className="mt-6 text-lg font-bold">Next week</h3>
              <ul className="mt-2 space-y-2">
                {w.retro.nextWeek.map((it, i) => (
                  <li key={i} className="text-sm">
                    <span className="mr-2 rounded-full border border-card-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">{it.tag}</span>
                    <span className="font-bold text-foreground">{it.title}</span> — <span className="text-muted">{it.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {w.sales.drivers.length > 0 && (
            <ul className="mt-4 space-y-2">
              {w.sales.drivers.map((d, i) => (
                <li key={i} className="text-sm">
                  <span className={`font-bold ${ACCENT[d.app] ?? "text-foreground"}`}>{d.app}</span> — <span className="font-bold">{d.lever}:</span> <span className="text-muted">{d.action} ({d.rationale})</span>
                </li>
              ))}
            </ul>
          )}

          {w.retro.appState?.length > 0 && (
            <>
              <h2 className="mt-10 border-b border-card-border pb-1 text-xl font-bold">State of each app</h2>
              <p className="mt-1 text-xs text-muted">Are we earning our users? Active-user, retention and crash signals fill in as the App Analytics feed backfills.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {w.retro.appState.map((a) => (
                  <div key={a.app} className="rounded-lg border border-card-border bg-card-bg/30 p-3">
                    <div className={`font-bold ${ACCENT[a.app] ?? "text-foreground"}`}>{a.name}</div>
                    <dl className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between gap-2"><dt className="text-muted">Downloads (wk)</dt><dd>{a.downloads ? `${a.downloads.thisWeek} (${pct(a.downloads.deltaPct)})` : "—"}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-muted">Rating</dt><dd>{a.rating.average != null ? `${a.rating.average.toFixed(1)}★ (${a.rating.count})` : "—"}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-muted">Active users</dt><dd className="text-muted/50">generating</dd></div>
                    </dl>
                    {a.verdict && <p className="mt-2 border-t border-card-border pt-2 text-xs leading-snug text-muted">{a.verdict}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </details>
    </main>
  );
}
