'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { DigestSummary } from '@/lib/this-week/types'
import { calendarByYear, matchesQuery } from '@/lib/this-week/calendar'

/** Year-of-weeks calendar + text search. Client island: holds the query and the
 *  selected year, derives everything from props via the pure calendar helpers. */
export default function ArchiveCalendar({ summaries }: { summaries: DigestSummary[] }) {
  const years = useMemo(() => calendarByYear(summaries), [summaries])
  const [query, setQuery] = useState('')
  const [yearIdx, setYearIdx] = useState(0)

  if (years.length === 0) return null

  const year = years[yearIdx]
  const q = query.trim()
  const totalInYear = year.cells.filter(c => c.summary).length
  const matchCount = q ? year.cells.filter(c => c.summary && matchesQuery(c.summary, q)).length : totalInYear

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs tracking-widest text-stone-400 uppercase">Browse every issue</h2>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search headlines & topics…"
          aria-label="Search issues"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none sm:w-64"
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        {years.length > 1 && (
          <button
            type="button"
            onClick={() => setYearIdx(i => Math.min(i + 1, years.length - 1))}
            disabled={yearIdx >= years.length - 1}
            aria-label="Older year"
            className="rounded px-2 py-1 text-stone-500 hover:text-emerald-700 disabled:opacity-30"
          >
            ←
          </button>
        )}
        <span className="text-lg font-bold tabular-nums text-stone-900">{year.year}</span>
        {years.length > 1 && (
          <button
            type="button"
            onClick={() => setYearIdx(i => Math.max(i - 1, 0))}
            disabled={yearIdx <= 0}
            aria-label="Newer year"
            className="rounded px-2 py-1 text-stone-500 hover:text-emerald-700 disabled:opacity-30"
          >
            →
          </button>
        )}
        {q && <span className="ml-auto text-xs text-stone-500">{matchCount} of {totalInYear} match</span>}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {year.cells.map(cell => {
          if (!cell.summary) {
            return <span key={cell.weekIndex} className="h-5 w-5 rounded-sm bg-stone-200/60" aria-hidden />
          }
          const s = cell.summary
          const dim = q !== '' && !matchesQuery(s, q)
          const color = s.mode === 'recess' ? 'bg-amber-500' : 'bg-emerald-600'
          return (
            <Link
              key={cell.weekIndex}
              href={`/hansard/this-week/${s.week}`}
              title={`${s.windowLabel} — ${s.headline}`}
              className={`h-5 w-5 rounded-sm transition hover:ring-2 hover:ring-stone-900/40 ${color} ${dim ? 'opacity-20' : ''}`}
            >
              <span className="sr-only">{s.windowLabel}: {s.headline}</span>
            </Link>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-emerald-600" /> sitting</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-amber-500" /> recess</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-stone-200/60" /> no issue</span>
      </div>
    </section>
  )
}
