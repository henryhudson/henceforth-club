import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listWeekSlugs, loadDigest } from '@/lib/this-week/store'
import Overview from '../_components/overview/Overview'

export const revalidate = 3600

type Params = { week: string }

export function generateStaticParams(): Params[] {
  return listWeekSlugs().map(week => ({ week }))
}

/** Card blurb: the intro's first full sentence when it's a sensible length,
 *  else a word-boundary clamp with an ellipsis — never a mid-word cut. */
function cardDescription(intro: string): string {
  const text = intro.trim()
  const m = text.match(/^(.*?[.!?])(\s|$)/)
  if (m && m[1].length >= 60 && m[1].length <= 240) return m[1]
  if (text.length <= 200) return text
  const slice = text.slice(0, 200)
  return slice.slice(0, slice.lastIndexOf(' ')).trimEnd() + '…'
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { week } = await params
  const digest = loadDigest(week)
  if (!digest) return { title: 'This Week in Parliament' }
  const title = digest.headline
    ? `${digest.headline} — This Week in Parliament`
    : `This Week in Parliament — ${digest.windowLabel}`
  const description = cardDescription(digest.intro ?? '')
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
  return <Overview digest={digest} week={week} />
}
