import Link from "next/link";
import WeekPlanner from "./WeekPlanner";
import { listWeeks, loadWeek } from "@/lib/board-data";

export const dynamic = "force-dynamic";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const weeks = await listWeeks();
  const active = date && weeks.includes(date) ? date : weeks[0];
  const w = active ? await loadWeek(active) : null;

  return (
    <main className="mx-auto px-6 py-10">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Weekly Schedule</h1>
        <div className="flex gap-3 text-sm text-accent-green">
          <Link href="/board" className="underline">Board</Link>
          <Link href="/board/reports" className="underline">Reports</Link>
          <Link href="/board/docs" className="underline">Plans &amp; specs</Link>
        </div>
      </div>

      {!w ? (
        <p className="mt-8 text-muted">No weekly review yet. Run <code>/whh</code> to generate one.</p>
      ) : (
        <>
          {w.retro.weekPlan?.length === 7 && (
            <>
              <h2 className="mt-10 border-b border-card-border pb-1 text-xl font-bold">This week&apos;s plan</h2>
              <p className="mt-1 text-xs text-muted">Wednesday ★ is update &amp; review · article day. Tick tasks off as you go.</p>
              <WeekPlanner days={w.retro.weekPlan} weekKey={w.weekEnd} />
            </>
          )}

          <p className="mt-6 text-sm">
            <Link href={`/board/reports/week/${active}`} className="text-accent-green underline">
              This week&apos;s report edition →
            </Link>
          </p>

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
