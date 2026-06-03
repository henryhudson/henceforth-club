import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadLatestPublishedDigest } from '@/lib/this-week/store'
import DigestView from './_components/DigestView'

export const revalidate = 3600

export function generateMetadata(): Metadata {
  const digest = loadLatestPublishedDigest()
  if (!digest) return { title: 'This Week in Parliament' }
  const title = `This Week in Parliament — ${digest.windowLabel}`
  const description =
    digest.intro?.slice(0, 180) ??
    'A weekly digest of what the UK House of Commons voted on and was asked.'
  return {
    title,
    description,
    openGraph: { title, description, type: 'article', url: '/hansard/this-week' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default function ThisWeekPage() {
  const digest = loadLatestPublishedDigest()
  if (!digest) notFound()
  return <DigestView digest={digest} />
}
