import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { listWeekSlugs, loadDigest } from '@/lib/this-week/store'
import DigestView from '../../_components/DigestView'

export const revalidate = 3600

type Params = { week: string }

export function generateStaticParams(): Params[] {
  return listWeekSlugs()
    .filter(week => Boolean(loadDigest(week)?.body?.length))
    .map(week => ({ week }))
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
    ? `${digest.headline} — This Week in Parliament — the full article`
    : `This Week in Parliament — ${digest.windowLabel} — the full article`
  const description = cardDescription(digest.intro ?? '')
  const url = `/hansard/this-week/${week}/full`
  return {
    title,
    description,
    openGraph: { title, description, type: 'article', url },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function WeekFullPage({ params }: { params: Promise<Params> }) {
  const { week } = await params
  const digest = loadDigest(week)
  if (!digest || digest.status !== 'published' || !digest.body?.length) notFound()
  return <DigestView digest={digest} />
}
