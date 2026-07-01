import { describe, it, expect } from 'vitest'
import type { DigestData } from './types'

it('DigestData carries an optional overview block', () => {
  const d = { overview: {
    headline: 'x', intro: 'y',
    brief: [{ title: 'Steel', when: '25 June', note: 'a' }],
    feature: { title: 'f', summary: 's' },
    mostActive: { asker: { name: 'A', party: 'Con', count: 98 },
                  answerer: { name: 'B', party: 'Lab', count: 175 } },
  } } as Partial<DigestData>
  expect(d.overview?.mostActive?.asker.count).toBe(98)
})
