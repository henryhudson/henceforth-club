import Link from "next/link";
import { listDates, listWeeks } from "@/lib/board-data";
import { editionIndex } from "@/lib/report-helpers";

export const dynamic = "force-dynamic";

export default async function ReportsIndex() {
  const [dailies, weeks] = await Promise.all([listDates(), listWeeks()]);
  const editions = editionIndex(dailies, weeks);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports</h1>
        <div className="flex gap-3 text-sm text-accent-green">
          <Link href="/board" className="underline">Board</Link>
          <Link href="/board/week" className="underline">Week</Link>
          <Link href="/board/docs" className="underline">Plans &amp; specs</Link>
        </div>
      </div>
      <p className="text-sm text-muted">One-page editions, newest first — daily morning briefs and weekly reviews.</p>
      <ol className="mt-6 flex flex-col">
        {editions.map((e) => (
          <li key={e.href} className="flex items-baseline border-b border-card-border py-3 last:border-b-0">
            <Link href={e.href} className="group flex items-baseline gap-3">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  e.type === "weekly"
                    ? "border-accent-warm/60 text-accent-warm"
                    : "border-accent-green/60 text-accent-green"
                }`}
              >
                {e.type}
              </span>
              <span className="font-semibold text-foreground group-hover:underline">
                {e.type === "weekly" ? `Week of ${e.date}` : e.date}
              </span>
            </Link>
            <a href={`${e.href}/pdf`} className="ml-auto text-xs text-muted underline hover:text-foreground">pdf</a>
          </li>
        ))}
        {editions.length === 0 && <p className="py-6 text-muted">No editions yet — run /hh.</p>}
      </ol>
    </main>
  );
}
