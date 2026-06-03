import type { Window } from '../window'
const BASE = 'https://whatson-api.parliament.uk/calendar/events/nonsitting.json'
export interface NonSittingRow { StartDate: string; EndDate: string; Category: string; CategoryCode: string; House: string }
export async function fetchNonSitting(w: Window, f: typeof fetch = fetch): Promise<NonSittingRow[]> {
  const res = await f(`${BASE}?startDate=${w.startISO}&endDate=${w.endISO}&house=Commons`)
  if (!res.ok) throw new Error(`nonsitting ${res.status}`)
  return (await res.json()) as NonSittingRow[]
}
export function recessInfo(w: Window, rows: NonSittingRow[]): { isRecess: boolean; returnISO: string | null } {
  const overlapping = rows.filter(r =>
    r.Category === 'Recess - Commons' &&
    r.StartDate.slice(0, 10) <= w.endISO && r.EndDate.slice(0, 10) >= w.startISO)
  if (overlapping.length === 0) return { isRecess: false, returnISO: null }
  const latestEnd = overlapping.map(r => r.EndDate.slice(0, 10)).sort().at(-1)!
  return { isRecess: true, returnISO: latestEnd }
}
