import { it, expect } from 'vitest'
import type { DigestData } from './types'
import { prepareDivisions, shortenDept, shortenDivTitle, trimSentences } from './overview'

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

const row = (ayes:number, noes:number, title='X', date='2026-06-24') => ({ row:{ id:0, title, date, ayes, noes } })

it('six or fewer divisions render as pills, seven or more as rows', () => {
  expect(prepareDivisions(Array.from({length:6}, ()=>row(300,100))).mode).toBe('pills')
  expect(prepareDivisions(Array.from({length:7}, ()=>row(300,100))).mode).toBe('rows')
})
it('divisions are ordered closest margin first', () => {
  const p = prepareDivisions([row(300,100), row(200,190), row(400,80)])
  expect(p.items.map(i=>i.margin)).toEqual([10,200,320])
})
it('past sixteen it caps and summarises the rest', () => {
  const p = prepareDivisions(Array.from({length:20}, (_,i)=>row(300,100+i)))
  expect(p.items.length).toBe(16); expect(p.overflow).toBe(4)
})
it('trimSentences keeps three sentences but never severs a bracket', () => {
  const t = 'One. Two. (Three starts. Four ends.) Five.'
  expect(trimSentences(t,3)).toBe('One. Two. (Three starts. Four ends.)')
})
it('trimSentences drops an unclosed opener if it cannot balance', () => {
  expect(trimSentences('One. Two. (Three with no close', 3)).toBe('One. Two.')
})
it('shortenDept and shortenDivTitle strip the boilerplate', () => {
  expect(shortenDept('Department of Health and Social Care')).toBe('Health')
  expect(shortenDivTitle('Armed Forces Bill Report Stage — New Clause 4')).toBe('Armed Forces Bill, New Clause 4')
})
it('trimSentences never splits at a mid-sentence parenthetical', () => {
  expect(trimSentences('The vote passed (narrowly) on Wednesday. MPs debated for hours.', 1))
    .toBe('The vote passed (narrowly) on Wednesday.')
})
