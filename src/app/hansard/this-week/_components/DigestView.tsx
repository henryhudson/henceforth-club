import Link from 'next/link'
import type { DigestData } from '@/lib/this-week/types'
import DepartmentChart from './DepartmentChart'

function FeatureBlock({ feature }: { feature: NonNullable<DigestData['feature']> }) {
  return (
    <div className="my-12 rounded-2xl border-2 border-emerald-700/25 bg-white p-7 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Story of the Week</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          {feature.count} questions
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-bold leading-snug text-stone-900">{feature.title}</h2>
      <p className="mt-1 text-xs text-stone-500">
        {[feature.asker, feature.party].filter(Boolean).join(' · ')} → {feature.department} · {feature.status}
      </p>
      <p className="mt-4 text-base leading-relaxed text-stone-700">{feature.summary}</p>
      {feature.questions.length > 0 && (
        <ul className="mt-5 space-y-2.5 border-l-2 border-emerald-700/20 pl-4">
          {feature.questions.map((q, i) => (
            <li key={i} className="text-sm italic leading-relaxed text-stone-600">{q}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QAQuote({ item }: { item: NonNullable<DigestData['qa']>[number] }) {
  const attribution = [item.asker, item.party, item.constituency].filter(Boolean).join(' · ')
  return (
    <div className="mt-8 border-l-2 border-stone-300 pl-5">
      <p className="text-base font-medium leading-snug text-stone-900">{item.question}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{item.answer}</p>
      <p className="mt-2 text-xs text-stone-400">
        {attribution ? `${attribution} · ` : ''}
        {item.department}
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
    <div className="my-12 text-center">
      <p className="text-[15px] leading-relaxed text-stone-700">{digest.intro}</p>
      {returnDate && <p className="mt-4 text-sm text-emerald-700">Parliament returns: {returnDate}</p>}
    </div>
  )
}

function EngagementCTA() {
  return (
    <div className="mt-16 border-t border-stone-200 pt-10">
      <p className="text-xl font-bold text-stone-900">Is this what you would have asked?</p>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-stone-600">
        Tell us what you&rsquo;d want your MP to put to the government this week &mdash; and see exactly
        what they actually asked, and how they voted, in the Hansard app.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <Link
          href="/hansard"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          See what your MP asked &rarr; Hansard
        </Link>
        <a href="#" className="text-sm text-stone-500 transition-colors hover:text-stone-800">
          Follow for next week &rarr;
        </a>
      </div>
    </div>
  )
}

export default function DigestView({ digest }: { digest: DigestData }) {
  const isRecess = digest.mode === 'recess'

  return (
    <div className="min-h-screen bg-[#faf9f6] py-16 text-stone-900 sm:py-24">
      <article className="mx-auto max-w-3xl px-6">
        {/* Masthead */}
        <p className="text-xs tracking-widest text-emerald-700 uppercase">This Week in Parliament</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">
          {digest.headline ?? digest.windowLabel}
        </h1>
        <p className="mt-3 text-sm text-stone-500">House of Commons · {digest.windowLabel}</p>

        {/* Standfirst */}
        {digest.intro && (
          <p className="mt-8 text-xl leading-relaxed text-stone-700">{digest.intro}</p>
        )}

        {/* Lead story */}
        {digest.feature && <FeatureBlock feature={digest.feature} />}

        {isRecess ? (
          <RecessView digest={digest} />
        ) : (
          <>
            {/* Body prose */}
            {digest.body?.map((para, i) => (
              <p key={i} className="mt-6 text-[17px] leading-relaxed text-stone-800">
                {para}
              </p>
            ))}

            {/* Chart figure */}
            {digest.departments.length > 0 && (
              <figure className="mt-12">
                <DepartmentChart departments={digest.departments} />
                <figcaption className="mt-3 text-xs text-stone-500">
                  Written questions by government department, {digest.windowLabel}.
                </figcaption>
              </figure>
            )}

            {/* Q&A pull-quotes */}
            {digest.qa && digest.qa.length > 0 && (
              <section className="mt-14">
                <h2 className="text-xs tracking-widest text-stone-400 uppercase">In their own words</h2>
                <p className="mt-2 text-sm text-stone-500">
                  A few questions &mdash; and the answers ministers actually gave.
                </p>
                {digest.qa.map((q, i) => (
                  <QAQuote key={i} item={q} />
                ))}
              </section>
            )}
          </>
        )}

        <EngagementCTA />
      </article>
    </div>
  )
}
