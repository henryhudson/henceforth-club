import { describe, it, expect } from 'vitest'
import { selectPublished } from './store'
import type { DigestData } from './types'

const digest = (week: string, status: DigestData['status']): DigestData => ({
  week,
  windowLabel: week,
  mode: 'normal',
  generatedAt: '',
  recessReturnISO: null,
  stats: { divisions: 0, questions: 0, distinctAskers: 0 },
  departments: [],
  highlights: { votes: [], questions: [], bills: [] },
  intro: '',
  status,
})

describe('selectPublished', () => {
  it('drops drafts and load failures, so the archive never links a 404', () => {
    const out = selectPublished([
      digest('2026-06-10', 'published'),
      null,
      digest('2026-06-03', 'draft'),
      digest('2026-05-27', 'published'),
    ])
    expect(out.map(d => d.week)).toEqual(['2026-06-10', '2026-05-27'])
  })

  it('preserves input (newest-first) order', () => {
    const out = selectPublished([
      digest('2026-06-10', 'published'),
      digest('2026-06-03', 'published'),
    ])
    expect(out.map(d => d.week)).toEqual(['2026-06-10', '2026-06-03'])
  })
})
