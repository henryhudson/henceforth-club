import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listPublishedWeeks, loadDigest } from '@/lib/this-week/store'
import DigestView from '../_components/DigestView'

export const revalidate = 3600

type Params = { week: string }

export function generateStaticParams(): Params[] {
  return listPublishedWeeks().map(week => ({ week }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { week } = await params
  const digest = loadDigest(week)
  if (!digest) return { title: 'This Week in Parliament' }
  const title = `This Week in Parliament — ${digest.windowLabel}`
  const description = (digest.intro ?? '').slice(0, 180)
  const url = `/hansard/this-week/${week}`
  return {
    title,
    description,
    openGraph: { title, description, type: 'article', url },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function WeekPage({ params }: { params: Promise<Params> }) {
  const { week } = await params
  const digest = loadDigest(week)
  if (!digest || digest.status !== 'published') notFound()
  return <DigestView digest={digest} />
}
