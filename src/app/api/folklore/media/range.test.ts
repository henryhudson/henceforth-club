import { describe, it, expect } from 'vitest'
import { parseRange } from './range'

// The contract Safari's video stack depends on: bounded, open-ended, and
// suffix ranges resolve to inclusive windows; nonsense and unsatisfiable
// asks are refused so the route answers 416 rather than lying with a 200.
describe('parseRange', () => {
  it('serves the whole file when no range was asked', () => {
    expect(parseRange(null, 1000)).toBeNull()
  })

  it('resolves a bounded range inclusively', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
  })

  it('clamps a bounded range to the file end', () => {
    expect(parseRange('bytes=900-2000', 1000)).toEqual({ start: 900, end: 999 })
  })

  it('resolves an open-ended range to the file end — the form Chrome sends first', () => {
    expect(parseRange('bytes=200-', 1000)).toEqual({ start: 200, end: 999 })
  })

  it('resolves the two-byte probe Safari opens with', () => {
    expect(parseRange('bytes=0-1', 1000)).toEqual({ start: 0, end: 1 })
  })

  it('resolves a suffix range to the final bytes', () => {
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=-2000', 1000)).toEqual({ start: 0, end: 999 })
  })

  it('refuses a start beyond the file, an inverted window, and malformed asks', () => {
    expect(parseRange('bytes=1000-', 1000)).toBe('invalid')
    expect(parseRange('bytes=50-10', 1000)).toBe('invalid')
    expect(parseRange('bytes=-0', 1000)).toBe('invalid')
    expect(parseRange('bytes=', 1000)).toBe('invalid')
    expect(parseRange('items=0-1', 1000)).toBe('invalid')
  })
})
