export type Mode = 'normal' | 'quiet' | 'recess'

export interface DivisionRow { id: number; title: string; date: string; ayes: number; noes: number }
export interface QuestionRow { id: number; askerId: number; askerName: string | null;
  party: string | null; constituency: string | null; department: string; heading: string; text: string }
export interface BillRow { id: number; title: string; house: string; stage: string; lastUpdate: string }

export interface DepartmentSlice { department: string; count: number }
export interface DigestStats { divisions: number; questions: number; distinctAskers: number }

/** Most-asked subjects this week, grouped by the clerk-assigned question heading. */
export interface TopicSlice { heading: string; count: number }

/** A featured written question with the minister's actual answer. */
export interface QAItem {
  heading: string
  asker: string | null
  party: string | null
  constituency: string | null
  department: string
  question: string
  answer: string
}

/** The lead "story of the week" — a cluster of linked questions on one subject,
 *  often hidden under null headings, that is the real talking point. */
export interface FeatureStory {
  title: string
  asker: string
  party: string | null
  department: string
  count: number
  status: string
  summary: string
  questions: string[]
}

export interface DigestData {
  week: string
  windowLabel: string
  mode: Mode
  generatedAt: string
  recessReturnISO: string | null
  stats: DigestStats
  departments: DepartmentSlice[]
  headline?: string
  body?: string[]
  feature?: FeatureStory
  topTopics?: TopicSlice[]
  qa?: QAItem[]
  highlights: {
    votes: { row: DivisionRow; blurb: string }[]
    questions: { row: QuestionRow; blurb: string }[]
    bills: { row: BillRow; blurb: string }[]
  }
  intro: string
  status: 'draft' | 'published'
}
