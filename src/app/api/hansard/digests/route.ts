import { NextResponse } from 'next/server'
import { listPublishedSummaries } from '@/lib/this-week/store'

// Read-only index of published "This Week in Parliament" digests, consumed by
// the Hansard iOS app to discover which weeks exist before fetching the full
// DigestData per week (GET /api/hansard/digests/[week]). Newest week first.
export const revalidate = 3600

export function GET() {
  const summaries = listPublishedSummaries()
  return NextResponse.json(summaries, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
