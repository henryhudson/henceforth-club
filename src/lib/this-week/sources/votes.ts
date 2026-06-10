import type { DivisionRow } from '../types'
import type { Window } from '../window'
interface RawDivision { DivisionId: number; Title: string; Date: string; AyeCount: number; NoCount: number }
const BASE = 'https://commonsvotes-api.parliament.uk/data/divisions.json'
export async function fetchDivisions(w: Window, f: typeof fetch = fetch): Promise<DivisionRow[]> {
  const q = `queryParameters.startDate=${w.startISO}&queryParameters.endDate=${w.endISO}&queryParameters.take=100`
  const res = await f(`${BASE}/search?${q}`)
  if (!res.ok) throw new Error(`votes search ${res.status}`)
  const data = (await res.json()) as RawDivision[]
  return data.map(d => ({ id: d.DivisionId, title: d.Title, date: d.Date, ayes: d.AyeCount, noes: d.NoCount }))
}
export async function fetchDivisionCount(w: Window, f: typeof fetch = fetch): Promise<number> {
  const q = `queryParameters.startDate=${w.startISO}&queryParameters.endDate=${w.endISO}`
  const res = await f(`${BASE}/searchTotalResults?${q}`)
  if (!res.ok) throw new Error(`votes count ${res.status}`)
  return Number((await res.text()).trim())
}
