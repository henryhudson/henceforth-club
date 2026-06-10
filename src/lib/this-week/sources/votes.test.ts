import { it, expect, vi } from 'vitest'
import { fetchDivisions } from './votes'
const sample = [{ DivisionId: 2360, Date: '2026-06-02T19:24:00', Title: 'Armed Forces Bill: NC13', AyeCount: 80, NoCount: 298, Number: 10, IsDeferred: false }]
it('maps the Commons Votes search payload to DivisionRow[]', async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => sample })
  const rows = await fetchDivisions({ startISO: '2026-05-27', endISO: '2026-06-03', label: '' }, f as unknown as typeof fetch)
  expect(rows[0]).toEqual({ id: 2360, title: 'Armed Forces Bill: NC13', date: '2026-06-02T19:24:00', ayes: 80, noes: 298 })
  expect(f.mock.calls[0][0]).toContain('queryParameters.startDate=2026-05-27')
  expect(f.mock.calls[0][0]).toContain('queryParameters.endDate=2026-06-03')
})
