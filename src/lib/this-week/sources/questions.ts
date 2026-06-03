import type { QuestionRow } from '../types'
import type { Window } from '../window'
const BASE = 'https://questions-statements-api.parliament.uk/api/writtenquestions/questions'
const PAGE = 100
export async function fetchQuestions(w: Window, f: typeof fetch = fetch): Promise<QuestionRow[]> {
  const rows: QuestionRow[] = []
  let skip = 0, total = Infinity
  while (skip < total) {
    const q = `tabledWhenFrom=${w.startISO}&tabledWhenTo=${w.endISO}&house=Commons&expandMember=true&skip=${skip}&take=${PAGE}`
    const res = await f(`${BASE}?${q}`)
    if (!res.ok) throw new Error(`questions ${res.status}`)
    const data = (await res.json()) as any
    total = data.totalResults
    for (const r of data.results) {
      const v = r.value
      rows.push({ id: v.id, askerId: v.askingMemberId, askerName: v.askingMember?.name ?? null,
        party: v.askingMember?.party ?? null, constituency: v.askingMember?.memberFrom ?? null,
        department: v.answeringBodyName, heading: v.heading, text: v.questionText })
    }
    skip += PAGE
  }
  return rows
}
