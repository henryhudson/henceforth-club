import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listPublishedWeeks, loadDigest } from '@/lib/this-week/store'
import DigestView from '../_components/DigestView'

export const revalidate = 3600

type Params = { week: string }

export function generateStaticParams(): Params[] {
  return listPublishedWeeks().map(week => ({ week }))
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const digest = loadDigest(params.week)
  if (!digest) return { title: 'This Week in Parliament' }
  return {
    title: `This Week in Parliament — ${digest.windowLabel}`,
    description: digest.intro.slice(0, 160),
  }
}

export default function WeekPage({ params }: { params: Params }) {
  const digest = loadDigest(params.week)
  if (!digest || digest.status !== 'published') notFound()
  return <DigestView digest={digest} />
}
