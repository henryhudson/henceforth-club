import { afterAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { DigestData } from '@/lib/this-week/types'

// One week's full digest for the Hansard app. A draft must 404 exactly as an
// unknown week does, so the app never caches an unpublishable issue. The store
// reads from disk under process.cwd(); the test points that at a scratch tree
// and exercises the real store and the real route.

const digest = (week: string, status: DigestData['status']): DigestData => ({
  week,
  windowLabel: `Week of ${week}`,
  mode: 'normal',
  generatedAt: '',
  recessReturnISO: null,
  stats: { divisions: 0, questions: 0, distinctAskers: 0 },
  departments: [],
  highlights: { votes: [], questions: [], bills: [] },
  intro: 'A published week.',
  status,
})

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hansard-digest-week-'))
const contentDir = path.join(root, 'content', 'this-week')
fs.mkdirSync(contentDir, { recursive: true })
const PUBLISHED = digest('2026-08-19', 'published')
const DRAFT = digest('2026-08-26', 'draft')
for (const d of [PUBLISHED, DRAFT]) {
  fs.writeFileSync(path.join(contentDir, `${d.week}.json`), JSON.stringify(d))
}
vi.spyOn(process, 'cwd').mockReturnValue(root)
const { GET } = await import('./route')

const get = (week: string) =>
  GET(new Request(`http://x/api/hansard/digests/${week}`), { params: Promise.resolve({ week }) })

afterAll(() => {
  vi.restoreAllMocks()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('GET /api/hansard/digests/[week]', () => {
  it('serves a published week whole', async () => {
    const res = await get('2026-08-19')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(PUBLISHED)
  })

  it('404s a draft, indistinguishably from a week that does not exist', async () => {
    const draft = await get('2026-08-26')
    const unknown = await get('2026-09-30')
    expect(draft.status).toBe(404)
    expect(unknown.status).toBe(404)
    expect(await draft.json()).toEqual(await unknown.json())
  })

  it('400s a slug that is not a date', async () => {
    expect((await get('latest')).status).toBe(400)
  })
})
