import type { DivisionRow } from './types'

export interface PreparedDivision {
  title: string; day: number; ayes: number; noes: number
  carried: boolean; margin: number; ayesPct: number
}
export interface PreparedDivisions {
  mode: 'none' | 'pills' | 'rows'
  items: PreparedDivision[]
  overflow: number
  overflowAllCarried: boolean
}

export function shortenDivTitle(t: string): string {
  return t.replace(/^Draft /, '').replace(/ 2026$/, '')
    .replace(/Customs \(Tariff and Miscellaneous Amendments\) \(No\. \d+\) Regulations/, 'Customs (Tariff) Regulations')
    .replace(/Climate Change Act 2008 \(International Aviation and International Shipping\) Regulations/, 'Climate Change Act, Aviation and Shipping')
    .replace(/Climate Change Act 2008 \(Credit Limit\) Order/, 'Climate Change Act, Credit Limit')
    .replace(/National Security \(State Threats\) Bill(?: Committee)? — /, 'National Security Bill, ')
    .replace(/National Security \(State Threats\) Bill(?: Committee)?/, 'National Security Bill')
    .replace(/Armed Forces Bill Report Stage — /, 'Armed Forces Bill, ')
    .replace(/Opposition Day — /, 'Opposition Day, ')
    .replace(/ — /g, ', ')
}

export function shortenDept(s: string): string {
  return s
    .replace('Department of Health and Social Care', 'Health').replace('Ministry of Defence', 'Defence')
    .replace('Ministry of Housing, Communities and Local Government', 'Housing').replace('Department for Transport', 'Transport')
    .replace('Department for Environment, Food and Rural Affairs', 'Environment').replace('Department for Education', 'Education')
    .replace('Department for Business and Trade', 'Business and Trade').replace('Department for Energy Security and Net Zero', 'Energy')
    .replace('Department for Work and Pensions', 'Work and Pensions')
    .replace('Foreign, Commonwealth and Development Office', 'Foreign Office')
    .replace(/^(\d+) other departments$/, '$1 others')
}

const CAP = 16
export function prepareDivisions(votes: { row: DivisionRow }[]): PreparedDivisions {
  if (!votes.length) return { mode: 'none', items: [], overflow: 0, overflowAllCarried: true }
  const all = votes.map(v => {
    const ayes = v.row.ayes, noes = v.row.noes, tot = ayes + noes || 1
    return { title: shortenDivTitle(v.row.title), day: parseInt(v.row.date.slice(8), 10),
      ayes, noes, carried: ayes > noes, margin: Math.abs(ayes - noes), ayesPct: ayes / tot * 100 }
  }).sort((a, b) => a.margin - b.margin)
  if (all.length <= 6) return { mode: 'pills', items: all, overflow: 0, overflowAllCarried: true }
  const items = all.slice(0, CAP), rest = all.slice(CAP)
  return { mode: 'rows', items, overflow: rest.length, overflowAllCarried: rest.every(r => r.carried) }
}

export function trimSentences(text: string, n: number): string {
  const parts = String(text || '').split(/(?<=\.\)?) /)
  const bal = (s: string) => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length
  let out = parts.slice(0, n).join(' ')
  for (let i = n; bal(out) > 0 && i < parts.length && i < n + 3; i++) out += ' ' + parts[i]
  if (bal(out) > 0) out = out.slice(0, out.lastIndexOf('(')).trim()
  return out
}
