import Link from 'next/link'
import type { DigestSummary } from '@/lib/this-week/types'

/** Top zone of the archive: the newest issue as a large hero, the prior 3 as a
 *  compact row. Server component — pure presentation, links to permalinks. */
export default function RecentHero({ recent }: { recent: DigestSummary[] }) {
  const [latest, ...rest] = recent
  if (!latest) return null

  return (
    <section>
      <p className="text-xs tracking-widest text-emerald-700 uppercase">This Week in Parliament</p>
      <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">Every issue</h1>
      <p className="mt-3 text-sm text-stone-500">
        A weekly digest of what the House of Commons voted on and was asked.
      </p>

      <Link
        href={`/hansard/this-week/${latest.week}`}
        className="group mt-10 block rounded-2xl border-2 border-emerald-700/25 bg-white p-7 shadow-sm transition hover:border-emerald-700/50"
      >
        <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">
          Latest · {latest.windowLabel}
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-snug text-stone-900 group-hover:text-emerald-700 sm:text-3xl">
          {latest.headline}
        </h2>
        {latest.feature && (
          <p className="mt-3 text-base leading-relaxed text-stone-600">{latest.feature}</p>
        )}
      </Link>

      {rest.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {rest.map(s => (
            <Link
              key={s.week}
              href={`/hansard/this-week/${s.week}`}
              className="group block rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-emerald-700/40"
            >
              <p className="text-xs text-stone-500">{s.windowLabel}</p>
              <h3 className="mt-1 text-sm font-semibold leading-snug text-stone-900 group-hover:text-emerald-700">
                {s.headline}
              </h3>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
