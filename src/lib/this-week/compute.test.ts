import { it, expect } from 'vitest'
import { departmentHistogram, buildStats, selectMode, rankVotes } from './compute'
import type { QuestionRow, DivisionRow } from './types'
const q = (id: number, dep: string, asker: number): QuestionRow =>
  ({ id, askerId: asker, askerName: 'MP', party: 'Lab', constituency: 'X', department: dep, heading: 'H', text: 'Q' })
it('department histogram counts and sorts desc', () => {
  expect(departmentHistogram([q(1,'Treasury',1), q(2,'Home Office',2), q(3,'Treasury',3)]))
    .toEqual([{ department: 'Treasury', count: 2 }, { department: 'Home Office', count: 1 }])
})
it('distinct askers counts unique askerId', () => {
  expect(buildStats(5, [q(1,'A',7), q(2,'B',7), q(3,'C',9)]).distinctAskers).toBe(2)
})
it('a quiet recess window is recess', () => {
  expect(selectMode({ isRecess: true, divisions: 0, questions: 0 })).toBe('recess')
})
it('a recess straddle with real activity is normal, not a holiday', () => {
  expect(selectMode({ isRecess: true, divisions: 4, questions: 2247 })).toBe('normal')
})
it('a sitting week with little activity is quiet, NOT recess', () => {
  expect(selectMode({ isRecess: false, divisions: 0, questions: 3 })).toBe('quiet')
})
it('a busy sitting week is normal', () => {
  expect(selectMode({ isRecess: false, divisions: 12, questions: 2000 })).toBe('normal')
})
it('rankVotes puts the closest division first', () => {
  const d = (id: number, a: number, n: number): DivisionRow => ({ id, title: 'T', date: '', ayes: a, noes: n })
  expect(rankVotes([d(1, 300, 200), d(2, 251, 250)], 2).map(v => v.id)).toEqual([2, 1])
})
