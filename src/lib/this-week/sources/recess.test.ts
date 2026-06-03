import { it, expect } from 'vitest'
import { recessInfo } from './recess'
it('detects a recess overlapping the window and returns the return date', () => {
  const rows = [
    { StartDate: '2026-05-22T00:00:00', EndDate: '2026-05-31T00:00:00', Category: 'Recess - Commons', CategoryCode: '2', House: 'Commons' },
    { StartDate: '2026-06-05T00:00:00', EndDate: '2026-06-05T00:00:00', Category: 'Non-sitting Friday - Commons', CategoryCode: '6', House: 'Commons' },
  ]
  const r = recessInfo({ startISO: '2026-05-27', endISO: '2026-06-03', label: '' }, rows)
  expect(r.isRecess).toBe(true)
  expect(r.returnISO).toBe('2026-05-31')
})
it('a window with only a non-sitting Friday is NOT recess', () => {
  const rows = [{ StartDate: '2026-06-05T00:00:00', EndDate: '2026-06-05T00:00:00', Category: 'Non-sitting Friday - Commons', CategoryCode: '6', House: 'Commons' }]
  expect(recessInfo({ startISO: '2026-06-01', endISO: '2026-06-08', label: '' }, rows).isRecess).toBe(false)
})
