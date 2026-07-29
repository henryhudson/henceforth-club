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
  /** Optional pill label (e.g. "Urgent Question · 9 Jun"). Falls back to "{count} questions"
   *  when the lead story is a written-question cluster rather than an oral proceeding. */
  kicker?: string
  status: string
  summary: string
  questions: string[]
}

export interface BriefItem { title: string; when: string; note: string }

/** One post in the government of the day. `great` lifts a post into the top
 *  band of the cabinet graphic — the offices a reader looks for first. */
export interface CabinetPost { office: string; name: string; great?: boolean }
export interface MostActiveEntry { name: string; party: string; count: number }
export interface OverviewBlock {
  headline: string
  intro: string
  brief?: BriefItem[]
  /** The government as it stands, rendered as a graphic rather than prose. */
  cabinet?: { title: string; note?: string; posts: CabinetPost[] }
  feature?: { title: string; summary: string }
  mostActive?: { asker: MostActiveEntry; answerer: MostActiveEntry }
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
  overview?: OverviewBlock
  highlights: {
    votes: { row: DivisionRow; blurb: string }[]
    questions: { row: QuestionRow; blurb: string }[]
    bills: { row: BillRow; blurb: string }[]
  }
  intro: string
  status: 'draft' | 'published'
}

/** Thin projection of a digest for the client archive (calendar + search).
 *  Keeps only what the browser renders — never the full DigestData. */
export interface DigestSummary {
  week: string            // YYYY-MM-DD Wednesday anchor = permalink slug
  windowLabel: string
  headline: string        // headline ?? windowLabel
  mode: Mode
  topics: string[]        // topTopics headings
  feature: string | null  // feature?.title ?? null
}

export interface YearCell { weekIndex: number; summary: DigestSummary | null }
export interface YearCalendar { year: number; cells: YearCell[] }
