import { describe, it, expect } from 'vitest'
import { toSummary, matchesQuery, calendarByYear } from './calendar'
import type { DigestData } from './types'

const base = (over: Partial<DigestData>): DigestData => ({
  week: '2026-06-10',
  windowLabel: '3–10 Jun 2026',
  mode: 'normal',
  generatedAt: '',
  recessReturnISO: null,
  stats: { divisions: 0, questions: 0, distinctAskers: 0 },
  departments: [],
  highlights: { votes: [], questions: [], bills: [] },
  intro: '',
  status: 'published',
  ...over,
})

describe('toSummary', () => {
  it('projects fields with headline + feature fallbacks', () => {
    const s = toSummary(base({ headline: undefined, topTopics: [{ heading: 'NHS', count: 3 }], feature: undefined }))
    expect(s.headline).toBe('3–10 Jun 2026') // falls back to windowLabel
    expect(s.topics).toEqual(['NHS'])
    expect(s.feature).toBeNull()
  })
})

describe('matchesQuery', () => {
  const s = toSummary(base({ headline: 'Belfast knife attack', topTopics: [{ heading: 'Justice', count: 1 }] }))
  it('empty/whitespace query matches all', () => {
    expect(matchesQuery(s, '')).toBe(true)
    expect(matchesQuery(s, '   ')).toBe(true)
  })
  it('is case-insensitive across headline and topics', () => {
    expect(matchesQuery(s, 'BELFAST')).toBe(true)
    expect(matchesQuery(s, 'justice')).toBe(true)
  })
  it('returns false on no match', () => {
    expect(matchesQuery(s, 'housing')).toBe(false)
  })
})

describe('calendarByYear', () => {
  it('groups by ISO year, fills cells in week order, leaves gaps null', () => {
    const cal = calendarByYear([toSummary(base({ week: '2026-06-10' })), toSummary(base({ week: '2026-06-03' }))])
    expect(cal[0].year).toBe(2026)
    const filled = cal[0].cells.filter(c => c.summary).map(c => c.summary!.week)
    expect(filled).toEqual(['2026-06-03', '2026-06-10'])
    expect(cal[0].cells.length).toBeGreaterThanOrEqual(52)
    expect(cal[0].cells.some(c => c.summary === null)).toBe(true)
  })

  it('handles the ISO-year boundary: 2021-01-01 belongs to ISO year 2020, a 53-week year', () => {
    const cal = calendarByYear([toSummary(base({ week: '2021-01-01' }))])
    expect(cal[0].year).toBe(2020)
    expect(cal[0].cells.length).toBe(53)
  })

  it('orders multiple years newest-first', () => {
    const cal = calendarByYear([toSummary(base({ week: '2026-01-07' })), toSummary(base({ week: '2025-01-08' }))])
    expect(cal.map(c => c.year)).toEqual([2026, 2025])
  })
})
