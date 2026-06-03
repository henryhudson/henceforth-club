import { sinceLastWednesday } from './window'
import type { Window } from './window'
import type { DigestData, DivisionRow, QuestionRow, BillRow } from './types'
import { fetchDivisions as realFetchDivisions, fetchDivisionCount as realFetchDivisionCount } from './sources/votes'
import { fetchQuestions as realFetchQuestions } from './sources/questions'
import { fetchMovedBills as realFetchMovedBills } from './sources/bills'
import { fetchNonSitting as realFetchNonSitting, recessInfo } from './sources/recess'
import type { NonSittingRow } from './sources/recess'
import { narrate as realNarrate } from './narrate'
import type { NarrateInput, NarrateOutput } from './narrate'
import { departmentHistogram, buildStats, selectMode, rankVotes } from './compute'

export interface GenerateDeps {
  fetchDivisions: (w: Window) => Promise<DivisionRow[]>
  fetchDivisionCount: (w: Window) => Promise<number>
  fetchQuestions: (w: Window) => Promise<QuestionRow[]>
  fetchMovedBills: (w: Window) => Promise<BillRow[]>
  fetchNonSitting: (w: Window) => Promise<NonSittingRow[]>
  narrate: (input: NarrateInput) => Promise<NarrateOutput>
}

const realDeps: GenerateDeps = {
  fetchDivisions: realFetchDivisions,
  fetchDivisionCount: realFetchDivisionCount,
  fetchQuestions: realFetchQuestions,
  fetchMovedBills: realFetchMovedBills,
  fetchNonSitting: realFetchNonSitting,
  narrate: realNarrate,
}

export async function generateDigest(now: Date, deps: GenerateDeps = realDeps): Promise<DigestData> {
  const w = sinceLastWednesday(now)

  const [
    divisionsResult,
    divisionCountResult,
    questionsResult,
    billsResult,
    nonSittingResult,
  ] = await Promise.allSettled([
    deps.fetchDivisions(w),
    deps.fetchDivisionCount(w),
    deps.fetchQuestions(w),
    deps.fetchMovedBills(w),
    deps.fetchNonSitting(w),
  ])

  const divisions: DivisionRow[] = divisionsResult.status === 'fulfilled' ? divisionsResult.value : []
  const divisionCount: number = divisionCountResult.status === 'fulfilled' ? divisionCountResult.value : 0
  const questions: QuestionRow[] = questionsResult.status === 'fulfilled' ? questionsResult.value : []
  const bills: BillRow[] = billsResult.status === 'fulfilled' ? billsResult.value : []
  const nonSitting: NonSittingRow[] = nonSittingResult.status === 'fulfilled' ? nonSittingResult.value : []

  const { isRecess, returnISO } = recessInfo(w, nonSitting)
  const mode = selectMode({ isRecess, divisions: divisionCount, questions: questions.length })
  const stats = buildStats(divisionCount, questions)
  const departments = departmentHistogram(questions)

  const rankedVotes = rankVotes(divisions, 5)
  const topBills = bills.slice(0, 5)

  const narrateInput: NarrateInput = {
    mode,
    windowLabel: w.label,
    stats,
    departments,
    votes: rankedVotes.map(r => ({ title: r.title, ayes: r.ayes, noes: r.noes })),
    questions: [],
    bills: topBills.map(b => ({ title: b.title, stage: b.stage })),
    recessReturnISO: returnISO,
  }

  const narration = await deps.narrate(narrateInput)

  const highlightVotes = rankedVotes.map((row, i) => ({ row, blurb: narration.votes[i] ?? '' }))
  const highlightBills = topBills.map((row, i) => ({ row, blurb: narration.bills[i] ?? '' }))

  return {
    week: w.endISO,
    windowLabel: w.label,
    mode,
    generatedAt: now.toISOString(),
    recessReturnISO: returnISO,
    stats,
    departments,
    highlights: {
      votes: highlightVotes,
      questions: [],
      bills: highlightBills,
    },
    intro: narration.intro,
    status: 'draft',
  }
}
