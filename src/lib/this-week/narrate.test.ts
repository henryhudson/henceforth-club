import { it, expect, vi } from 'vitest'
import { narrate } from './narrate'
it('asks for blurbs in the cheeky voice and returns parsed strings', async () => {
  const create = vi.fn().mockResolvedValue({ content: [{ type: 'text',
    text: JSON.stringify({ intro: 'Parliament did things.', votes: ['v'], questions: [], bills: ['b'] }) }] })
  const client = { messages: { create } } as any
  const out = await narrate({ mode: 'recess', windowLabel: 'x', stats: { divisions: 0, questions: 0, distinctAskers: 0 },
    departments: [], votes: [], questions: [], bills: [], recessReturnISO: '2026-05-31' }, client)
  expect(out.intro).toContain('Parliament')
  expect(create.mock.calls[0][0].model).toBe('claude-opus-4-8')
  expect(JSON.stringify(create.mock.calls[0][0])).toContain('recess')
})
