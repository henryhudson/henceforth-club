import Link from "next/link";
import WeekPlanner from "./WeekPlanner";
import { listWeeks, loadWeek } from "@/lib/board-data";

export const dynamic = "force-dynamic";

const ACCENT: Record<string, string> = { henceforth: "text-accent-warm", hansard: "text-accent-green", deck: "text-accent" };
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`);

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const weeks = await listWeeks();
  const active = date && weeks.includes(date) ? date : weeks[0];
  const w = active ? await loadWeek(active) : null;

  return (
    <main className="mx-auto px-6 py-10">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Weekly Review</h1>
        <div className="flex gap-3 text-sm text-accent-green">
          <Link href="/board" className="underline">Board</Link>
          <Link href="/board/report" className="underline">Morning report</Link>
          <Link href="/board/docs" className="underline">Plans &amp; specs</Link>
        </div>
      </div>

      {!w ? (
        <p className="mt-8 text-muted">No weekly review yet. Run <code>/whh</code> to generate one.</p>
      ) : (
        <>
          <p className="text-muted">Week of {w.weekOf} → {w.weekEnd} · {w.daysCovered.length} review days</p>

          {w.retro.stateOfUnion && (
            <p className="mt-4 border-l-2 border-accent-green/50 pl-4 text-lg leading-relaxed text-foreground">{w.retro.stateOfUnion}</p>
          )}

          <h2 className="mt-8 border-b border-card-border pb-1 text-xl font-bold">How the week went</h2>
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

          {w.retro.weekPlan?.length === 7 && (
            <>
              <h2 className="mt-10 border-b border-card-border pb-1 text-xl font-bold">This week&apos;s plan</h2>
              <p className="mt-1 text-xs text-muted">Wednesday ★ is update &amp; review · article day. Tick tasks off as you go.</p>
              <WeekPlanner days={w.retro.weekPlan} weekKey={w.weekEnd} />
            </>
          )}
          <h2 className="mt-10 border-b border-card-border pb-1 text-xl font-bold">Driving sales</h2>
          {w.sales.note && <p className="mt-3 text-muted">{w.sales.note}</p>}
          {w.sales.perApp.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1">App</th><th>Downloads</th><th>Last week</th><th>Change</th>
                </tr>
              </thead>
              <tbody>
                {w.sales.perApp.map((a) => (
                  <tr key={a.app} className="border-t border-card-border">
                    <td className={`py-1 font-bold ${ACCENT[a.app] ?? "text-foreground"}`}>{a.name}</td>
                    <td>{a.units.thisWeek}</td>
                    <td className="text-muted">{a.units.lastWeek}</td>
                    <td className="text-muted">{pct(a.units.deltaPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {w.sales.source && <p className="mt-1 text-xs text-muted">Source: {w.sales.source}</p>}
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

          {weeks.length >= 1 && (
            <div className="mt-10 flex flex-wrap gap-2 text-xs text-muted">
              {weeks.map((d) => (
                <Link key={d} href={`/board/week?date=${d}`} className={d === active ? "font-bold underline" : "underline"}>{d}</Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
