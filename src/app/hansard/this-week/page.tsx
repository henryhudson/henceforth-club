import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listPublishedSummaries } from '@/lib/this-week/store'
import RecentHero from './_components/RecentHero'
import ArchiveCalendar from './_components/ArchiveCalendar'

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
  const summaries = listPublishedSummaries()
  if (summaries.length === 0) notFound()

  return (
    <div className="min-h-screen bg-[#faf9f6] py-16 text-stone-900 sm:py-24">
      <main className="mx-auto max-w-3xl px-6">
        <RecentHero recent={summaries.slice(0, 4)} />
        <ArchiveCalendar summaries={summaries} />
      </main>
    </div>
  )
}
