import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listPublishedDigests } from '@/lib/this-week/store'

export const revalidate = 3600

export function generateMetadata(): Metadata {
  const title = 'This Week in Parliament'
  const description =
    'Every weekly digest of what the UK House of Commons voted on and was asked.'
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', url: '/hansard/this-week' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function ThisWeekArchivePage() {
  const digests = listPublishedDigests()
  if (digests.length === 0) notFound()

  return (
    <div className="min-h-screen bg-[#faf9f6] py-16 text-stone-900 sm:py-24">
      <main className="mx-auto max-w-3xl px-6">
        <p className="text-xs tracking-widest text-emerald-700 uppercase">This Week in Parliament</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">Every issue</h1>
        <p className="mt-3 text-sm text-stone-500">
          A weekly digest of what the House of Commons voted on and was asked.
        </p>

        <ul className="mt-12 divide-y divide-stone-200">
          {digests.map(digest => (
            <li key={digest.week}>
              <Link href={`/hansard/this-week/${digest.week}`} className="group block py-6">
                <p className="text-sm text-stone-500">{digest.windowLabel}</p>
                <h2 className="mt-1 text-xl font-bold leading-snug text-stone-900 group-hover:text-emerald-700">
                  {digest.headline ?? digest.windowLabel}
                </h2>
                {digest.intro && (
                  <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-stone-600">
                    {digest.intro}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
