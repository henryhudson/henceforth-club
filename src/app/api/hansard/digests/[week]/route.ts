import { NextResponse } from 'next/server'
import { loadDigest, listWeekSlugs } from '@/lib/this-week/store'

// One published week's full DigestData, by Wednesday-anchor slug (YYYY-MM-DD).
// Consumed by the Hansard iOS app to enrich its bundled snapshot with newer
// weeks. Drafts and unknown weeks 404 so the app never caches an unpublishable
// issue.
export const revalidate = 3600

export function generateStaticParams(): { week: string }[] {
  return listWeekSlugs().map(week => ({ week }))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ week: string }> }
) {
  const { week } = await params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: 'Invalid week' }, { status: 400 })
  }

  const digest = loadDigest(week)
  if (!digest || digest.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(digest, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
