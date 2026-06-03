import { describe, it, expect } from 'vitest'
import { sinceLastWednesday } from './window'

describe('sinceLastWednesday', () => {
  it('a Wednesday 05:00 UTC run covers the previous Wed→this Wed', () => {
    // 2026-06-03 is a Wednesday. BST (UTC+1) in June.
    const w = sinceLastWednesday(new Date('2026-06-03T05:00:00Z'))
    expect(w.startISO).toBe('2026-05-27') // last Wed
    expect(w.endISO).toBe('2026-06-03')   // this Wed
    expect(w.label).toBe('27 May – 3 Jun 2026')
  })
  it('handles a non-Wednesday run by anchoring to the most recent Wednesday', () => {
    const w = sinceLastWednesday(new Date('2026-06-05T09:00:00Z')) // Friday
    expect(w.endISO).toBe('2026-06-03')
    expect(w.startISO).toBe('2026-05-27')
  })
})
