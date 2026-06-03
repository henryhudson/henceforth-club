import { it, expect, vi } from 'vitest'
import { fetchQuestions } from './questions'
const page = (n: number) => ({ totalResults: 150, results: Array.from({ length: n }, (_, i) => ({
  value: { id: i, askingMemberId: 10 + (i % 3), askingMember: { name: 'MP', party: 'Lab', memberFrom: 'X' },
    answeringBodyName: i % 2 ? 'Treasury' : 'Home Office', heading: 'H', questionText: 'Q' } })) })
it('paginates all pages and maps to QuestionRow[]', async () => {
  const f = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => page(100) })
    .mockResolvedValueOnce({ ok: true, json: async () => page(50) })
  const rows = await fetchQuestions({ startISO: '2026-05-27', endISO: '2026-06-03', label: '' }, f as any)
  expect(rows.length).toBe(150)
  expect(f.mock.calls[0][0]).toContain('house=Commons')
  expect(f.mock.calls[0][0]).toContain('tabledWhenFrom=2026-05-27')
  expect(rows[0].department).toBe('Home Office')
})
