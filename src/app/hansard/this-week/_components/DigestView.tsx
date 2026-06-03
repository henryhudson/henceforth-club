import Link from 'next/link'
import type { DigestData } from '@/lib/this-week/types'
import DepartmentChart from './DepartmentChart'

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-card-border bg-card-bg/50 p-5">
      <span className="text-3xl font-bold text-foreground">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="mt-1 text-xs tracking-wide text-muted/60 uppercase">{label}</span>
    </div>
  )
}

function VoteCard({ vote }: { vote: DigestData['highlights']['votes'][number] }) {
  const { row, blurb } = vote
  const margin = row.ayes - row.noes
  const total = row.ayes + row.noes
  const ayePct = total > 0 ? Math.round((row.ayes / total) * 100) : 50
  const result = margin > 0 ? 'Passed' : 'Rejected'
  const resultColour = margin > 0 ? 'text-accent-green' : 'text-red-400'

  return (
    <div className="rounded-xl border border-card-border bg-card-bg/50 p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">{row.title}</h3>
        <span className={`shrink-0 text-xs font-semibold ${resultColour}`}>{result}</span>
      </div>
      {/* Aye/Noe bar */}
      <div>
        <div className="flex overflow-hidden rounded-full h-1.5">
          <div
            className="bg-accent-green"
            style={{ width: `${ayePct}%` }}
          />
          <div className="flex-1 bg-red-400/40" />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted/60">
          <span>Ayes {row.ayes.toLocaleString()}</span>
          <span>Noes {row.noes.toLocaleString()}</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted">{blurb}</p>
      <p className="text-[10px] text-muted/40">
        {new Date(row.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}

function BillCard({ bill }: { bill: DigestData['highlights']['bills'][number] }) {
  const { row, blurb } = bill
  return (
    <div className="rounded-xl border border-card-border bg-card-bg/50 p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">{row.title}</h3>
        <span className="shrink-0 rounded-full border border-card-border px-2 py-0.5 text-[10px] text-muted/70 whitespace-nowrap">
          {row.house}
        </span>
      </div>
      <p className="text-[11px] text-accent-green/80">{row.stage}</p>
      <p className="text-xs leading-relaxed text-muted">{blurb}</p>
      <p className="text-[10px] text-muted/40">
        Updated{' '}
        {new Date(row.lastUpdate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}

function RecessView({ digest }: { digest: DigestData }) {
  const returnDate = digest.recessReturnISO
    ? new Date(digest.recessReturnISO).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex flex-col items-center text-center py-16 gap-6">
      <p className="text-xs tracking-widest text-muted/50 uppercase">This week in Parliament</p>
      <h2 className="text-2xl font-bold text-foreground">{digest.windowLabel}</h2>
      <div className="max-w-lg rounded-xl border border-card-border bg-card-bg/50 p-8">
        <p className="text-sm leading-relaxed text-muted">{digest.intro}</p>
        {returnDate && (
          <p className="mt-4 text-xs text-accent-green/80">
            Parliament returns: {returnDate}
          </p>
        )}
      </div>
    </div>
  )
}

export default function DigestView({ digest }: { digest: DigestData }) {
  const isRecess = digest.mode === 'recess'

  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-xs tracking-widest text-accent-green/70 uppercase">
            This Week in Parliament
          </p>
          <h1 className="mt-6 text-4xl sm:text-6xl text-foreground font-bold">
            {digest.windowLabel}
          </h1>
        </div>

        {isRecess ? (
          <div className="mt-12">
            <RecessView digest={digest} />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard value={digest.stats.divisions} label="Divisions" />
              <StatCard value={digest.stats.questions.toLocaleString()} label="Written Questions" />
              <StatCard value={digest.stats.distinctAskers} label="Members asking" />
            </div>

            {/* Intro */}
            <div className="mt-12">
              <div className="section-line" />
              <p className="mt-8 text-xs tracking-widest text-muted/50 uppercase">Overview</p>
              <p className="mt-4 text-sm leading-relaxed text-muted max-w-2xl">{digest.intro}</p>
            </div>

            {/* Department chart */}
            {digest.departments.length > 0 && (
              <div className="mt-12">
                <div className="section-line" />
                <p className="mt-8 text-xs tracking-widest text-muted/50 uppercase">
                  Questions by Department
                </p>
                <p className="mt-2 text-xs text-muted/50">
                  Top departments by written question volume this week
                </p>
                <div className="mt-6">
                  <DepartmentChart departments={digest.departments} />
                </div>
              </div>
            )}

            {/* Votes */}
            {digest.highlights.votes.length > 0 && (
              <div className="mt-12">
                <div className="section-line" />
                <p className="mt-8 text-xs tracking-widest text-muted/50 uppercase">
                  Notable Divisions
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {digest.highlights.votes.map(v => (
                    <VoteCard key={v.row.id} vote={v} />
                  ))}
                </div>
              </div>
            )}

            {/* Bills */}
            {digest.highlights.bills.length > 0 && (
              <div className="mt-12">
                <div className="section-line" />
                <p className="mt-8 text-xs tracking-widest text-muted/50 uppercase">
                  Bills in Progress
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {digest.highlights.bills.map(b => (
                    <BillCard key={b.row.id} bill={b} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* CTAs */}
        <div className="mt-20">
          <div className="section-line mb-10" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Link
              href="/hansard"
              className="inline-flex items-center gap-2 rounded-full border border-accent-green/40 bg-accent-green/10 px-6 py-3 text-sm text-accent-green hover:bg-accent-green/20 transition-colors"
            >
              Get Hansard — 99p →
            </Link>
            <a
              href="#"
              className="text-sm text-muted/60 hover:text-muted transition-colors"
            >
              Follow for next week →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
