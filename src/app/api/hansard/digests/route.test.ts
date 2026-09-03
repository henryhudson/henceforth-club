import { afterAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { DigestData } from '@/lib/this-week/types'

// The Hansard app's discovery path: it reads this index to learn which weeks
// exist before fetching each one. A draft listed here would be fetched and
// 404, so the index must carry published weeks only. The store reads the
// digests from disk under process.cwd(), so the test points that at a
// scratch tree holding two published weeks and a draft, and exercises the
// real store, the real summary projection and the real route.

const digest = (week: string, status: DigestData['status'], headline?: string): DigestData => ({
  week,
  windowLabel: `Week of ${week}`,
  mode: 'normal',
  generatedAt: '',
  recessReturnISO: null,
  stats: { divisions: 0, questions: 0, distinctAskers: 0 },
  departments: [],
  highlights: { votes: [], questions: [], bills: [] },
  intro: '',
  status,
  ...(headline ? { headline } : {}),
})

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hansard-digests-'))
const contentDir = path.join(root, 'content', 'this-week')
fs.mkdirSync(contentDir, { recursive: true })
for (const d of [
  digest('2026-08-12', 'published'),
  digest('2026-08-19', 'published', 'The last sitting week'),
  digest('2026-08-26', 'draft'),
]) {
  fs.writeFileSync(path.join(contentDir, `${d.week}.json`), JSON.stringify(d))
}
vi.spyOn(process, 'cwd').mockReturnValue(root)
const { GET } = await import('./route')

afterAll(() => {
  vi.restoreAllMocks()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('GET /api/hansard/digests', () => {
  it('lists published weeks only, newest first — a draft is never offered to the app', async () => {
    const res = GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { week: string }[]
    expect(body.map(s => s.week)).toEqual(['2026-08-19', '2026-08-12'])
  })

  it('returns the thin summary the app decodes, not the whole digest', async () => {
    const [latest] = (await GET().json()) as Record<string, unknown>[]
    expect(latest).toEqual({
      week: '2026-08-19',
      windowLabel: 'Week of 2026-08-19',
      headline: 'The last sitting week',
      mode: 'normal',
      topics: [],
      feature: null,
    })
  })
})
