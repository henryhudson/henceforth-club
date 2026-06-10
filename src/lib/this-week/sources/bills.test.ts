import { it, expect, vi } from 'vitest'
import { fetchMovedBills } from './bills'
const items = [
  { billId: 4065, shortTitle: 'Armed Forces Bill', currentHouse: 'Commons', lastUpdate: '2026-06-03T11:43:02', currentStage: { description: 'Report stage' }, isAct: false },
  { billId: 9, shortTitle: 'Old Bill', currentHouse: 'Lords', lastUpdate: '2026-04-01T00:00:00', currentStage: { description: '1st reading' }, isAct: false },
]
it('keeps only bills updated within the window', async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ totalResults: 2, items }) })
  const rows = await fetchMovedBills({ startISO: '2026-05-27', endISO: '2026-06-03', label: '' }, f as unknown as typeof fetch)
  expect(rows.map(b => b.id)).toEqual([4065])
  expect(rows[0].stage).toBe('Report stage')
})
