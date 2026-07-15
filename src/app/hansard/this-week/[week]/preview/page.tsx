import { notFound } from 'next/navigation'
import { loadDigest } from '@/lib/this-week/store'
import Overview from '../../_components/overview/Overview'

// Dev-only draft preview, used by scripts/this-week/render-draft.mjs to render an
// unpublished issue to a review PDF. It renders a `draft` digest — but ONLY when
// not in production, so a half-checked issue can never leak on the live site. The
// public [week] page is untouched and stays statically generated; this route
// always 404s in production.
export const dynamic = 'force-dynamic'

type Params = { week: string }

export default async function WeekPreviewPage({ params }: { params: Promise<Params> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { week } = await params
  const digest = loadDigest(week)
  if (!digest) notFound()
  return <Overview digest={digest} week={week} />
}
