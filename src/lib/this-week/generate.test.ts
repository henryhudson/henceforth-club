import { describe, it, expect } from 'vitest'
import { generateDigest } from './generate'
import type { DivisionRow, QuestionRow, BillRow } from './types'
import type { NonSittingRow } from './sources/recess'
import type { Window } from './window'

const now = new Date('2026-05-28T12:00:00Z')

const divisions: DivisionRow[] = [
  { id: 1, title: 'Austerity Bill', date: '2026-05-26', ayes: 300, noes: 200 },
  { id: 2, title: 'Housing Motion', date: '2026-05-27', ayes: 250, noes: 248 },
]
const divisionCount = 2

const questions: QuestionRow[] = [
  { id: 10, askerId: 1, askerName: 'Alice MP', party: 'Labour', constituency: 'A', department: 'Treasury', heading: 'Fiscal policy', text: 'q1' },
  { id: 11, askerId: 2, askerName: 'Bob MP', party: 'Conservative', constituency: 'B', department: 'Treasury', heading: 'Tax rates', text: 'q2' },
  { id: 12, askerId: 3, askerName: 'Carol MP', party: 'Lib Dem', constituency: 'C', department: 'Health', heading: 'NHS funding', text: 'q3' },
]

const bills: BillRow[] = [
  { id: 100, title: 'Finance Bill', house: 'Commons', stage: 'Second Reading', lastUpdate: '2026-05-26' },
]

// A recess row that overlaps the window 2026-05-21 – 2026-05-28
const nonSitting: NonSittingRow[] = [
  { StartDate: '2026-05-22', EndDate: '2026-05-29', Category: 'Recess - Commons', CategoryCode: 'R', House: 'Commons' },
]

const fakeNarrate = async (_input: any) => ({
  intro: 'Parliament went on holiday.',
  votes: ['v1', 'v2'],
  questions: [],
  bills: ['b1'],
})

describe('generateDigest', () => {
  it('orchestrates all sources and returns a valid DigestData draft', async () => {
    const result = await generateDigest(now, {
      fetchDivisions: async (_w: Window) => divisions,
      fetchDivisionCount: async (_w: Window) => divisionCount,
      fetchQuestions: async (_w: Window) => questions,
      fetchMovedBills: async (_w: Window) => bills,
      fetchNonSitting: async (_w: Window) => nonSitting,
      narrate: fakeNarrate,
    })

    // The recess row overlaps the window, but there were real votes and
    // questions — a straddle week is 'normal' (not a holiday). The recess
    // return date is still captured (asserted below).
    expect(result.mode).toBe('normal')

    // stats
    expect(result.stats.questions).toBe(3)
    expect(result.stats.divisions).toBe(2)

    // departments histogram is non-empty
    expect(result.departments.length).toBeGreaterThan(0)
    expect(result.departments[0].department).toBe('Treasury') // highest count

    // highlights.votes has length 2 (both divisions) with blurbs
    expect(result.highlights.votes).toHaveLength(2)
    expect(result.highlights.votes[0].blurb).toBeTruthy()
    expect(result.highlights.votes[0].row).toBeDefined()

    // highlights.questions is empty (deferred)
    expect(result.highlights.questions).toHaveLength(0)

    // bills highlights
    expect(result.highlights.bills).toHaveLength(1)
    expect(result.highlights.bills[0].blurb).toBe('b1')
    expect(result.highlights.bills[0].row.title).toBe('Finance Bill')

    // metadata
    expect(result.status).toBe('draft')
    expect(result.generatedAt).toBe(now.toISOString())
    expect(result.recessReturnISO).toBe('2026-05-29')
    expect(result.windowLabel).toBeTruthy()
    expect(result.week).toBeTruthy()
    expect(result.intro).toContain('Parliament')
  })

  it('degrades gracefully when a source rejects', async () => {
    const result = await generateDigest(now, {
      fetchDivisions: async (_w: Window) => { throw new Error('network') },
      fetchDivisionCount: async (_w: Window) => { throw new Error('network') },
      fetchQuestions: async (_w: Window) => questions,
      fetchMovedBills: async (_w: Window) => bills,
      fetchNonSitting: async (_w: Window) => [],
      narrate: fakeNarrate,
    })

    // votes section is empty but rest still works
    expect(result.highlights.votes).toHaveLength(0)
    expect(result.stats.questions).toBe(3)
    expect(result.status).toBe('draft')
  })
})
