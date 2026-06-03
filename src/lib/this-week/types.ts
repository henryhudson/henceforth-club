export type Mode = 'normal' | 'quiet' | 'recess'

export interface DivisionRow { id: number; title: string; date: string; ayes: number; noes: number }
export interface QuestionRow { id: number; askerId: number; askerName: string | null;
  party: string | null; constituency: string | null; department: string; heading: string; text: string }
export interface BillRow { id: number; title: string; house: string; stage: string; lastUpdate: string }

export interface DepartmentSlice { department: string; count: number }
export interface DigestStats { divisions: number; questions: number; distinctAskers: number }

export interface DigestData {
  week: string
  windowLabel: string
  mode: Mode
  generatedAt: string
  recessReturnISO: string | null
  stats: DigestStats
  departments: DepartmentSlice[]
  highlights: {
    votes: { row: DivisionRow; blurb: string }[]
    questions: { row: QuestionRow; blurb: string }[]
    bills: { row: BillRow; blurb: string }[]
  }
  intro: string
  status: 'draft' | 'published'
}
