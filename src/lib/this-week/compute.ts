import type { QuestionRow, DivisionRow, DepartmentSlice, DigestStats, Mode } from './types'
export function departmentHistogram(qs: QuestionRow[]): DepartmentSlice[] {
  const m = new Map<string, number>()
  for (const q of qs) m.set(q.department, (m.get(q.department) ?? 0) + 1)
  return [...m.entries()].map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department))
}
export function buildStats(divisions: number, qs: QuestionRow[]): DigestStats {
  return { divisions, questions: qs.length, distinctAskers: new Set(qs.map(q => q.askerId)).size }
}
const QUIET_QUESTION_THRESHOLD = 200
export function selectMode(x: { isRecess: boolean; divisions: number; questions: number }): Mode {
  if (x.isRecess) return 'recess'
  if (x.divisions === 0 && x.questions < QUIET_QUESTION_THRESHOLD) return 'quiet'
  return 'normal'
}
export function rankVotes(rows: DivisionRow[], n = 5): DivisionRow[] {
  return [...rows].sort((a, b) =>
    Math.abs(a.ayes - a.noes) - Math.abs(b.ayes - b.noes) ||
    (b.ayes + b.noes) - (a.ayes + a.noes)).slice(0, n)
}
