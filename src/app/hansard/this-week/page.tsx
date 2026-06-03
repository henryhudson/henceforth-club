import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadLatestPublishedDigest } from '@/lib/this-week/store'
import DigestView from './_components/DigestView'

export const revalidate = 3600

export function generateMetadata(): Metadata {
  const digest = loadLatestPublishedDigest()
  if (!digest) return { title: 'This Week in Parliament' }
  return {
    title: `This Week in Parliament — ${digest.windowLabel}`,
    description: digest.intro.slice(0, 160),
  }
}

export default function ThisWeekPage() {
  const digest = loadLatestPublishedDigest()
  if (!digest) notFound()
  return <DigestView digest={digest} />
}
