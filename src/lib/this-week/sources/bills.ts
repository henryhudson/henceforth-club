import type { BillRow } from '../types'
import type { Window } from '../window'
const BASE = 'https://bills-api.parliament.uk/api/v1/Bills'
const PAGE = 50
interface RawBill { billId: number; shortTitle: string; currentHouse: string; currentStage?: { description?: string } | null; lastUpdate: string }
interface BillsResponse { items: RawBill[]; totalResults: number }
export async function fetchMovedBills(w: Window, f: typeof fetch = fetch): Promise<BillRow[]> {
  const out: BillRow[] = []
  let skip = 0
  for (;;) {
    const res = await f(`${BASE}?SortOrder=DateUpdatedDescending&take=${PAGE}&skip=${skip}`)
    if (!res.ok) throw new Error(`bills ${res.status}`)
    const data = (await res.json()) as BillsResponse
    let hitCutoff = false
    for (const b of data.items) {
      if (b.lastUpdate.slice(0, 10) < w.startISO) { hitCutoff = true; break }
      out.push({ id: b.billId, title: b.shortTitle, house: b.currentHouse,
        stage: b.currentStage?.description ?? '—', lastUpdate: b.lastUpdate })
    }
    skip += PAGE
    if (hitCutoff || skip >= data.totalResults || data.items.length === 0) break
  }
  return out
}
