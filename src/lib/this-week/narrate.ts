import Anthropic from '@anthropic-ai/sdk'
import type { Mode, DigestStats, DepartmentSlice } from './types'

export interface NarrateInput {
  mode: Mode; windowLabel: string; stats: DigestStats; departments: DepartmentSlice[]
  votes: { title: string; ayes: number; noes: number }[]
  questions: { heading: string; department: string }[]
  bills: { title: string; stage: string }[]
  recessReturnISO: string | null
}
export interface NarrateOutput { intro: string; votes: string[]; questions: string[]; bills: string[] }

const SYSTEM = `You write "This Week in Parliament", a weekly digest of the UK House of Commons.
Voice: informative with a cheeky edge — credible enough that the numbers are trusted, with enough
personality to be shareable. NEVER editorialise the numbers themselves, only the framing.
Mode: in "recess" be openly playful (Parliament is on holiday); in "quiet" be wryly underwhelmed
(a slow week — they WERE there, so do not say "holiday"); in "normal" be wry but straight.
Return ONLY minified JSON: {"intro": string, "votes": string[], "questions": string[], "bills": string[]}
with one short blurb (max ~20 words) per provided highlight, in the same order. "intro" is 1-2 sentences.`

export async function narrate(input: NarrateInput, client = new Anthropic()): Promise<NarrateOutput> {
  const res = await client.messages.create({
    model: 'claude-opus-4-8', max_tokens: 1024, system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })
  const block = res.content.find((b) => b.type === 'text')
  const text = block && 'text' in block ? block.text : '{}'
  return JSON.parse(text) as NarrateOutput
}
