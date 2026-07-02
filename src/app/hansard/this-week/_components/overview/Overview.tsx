import type { DigestData } from '@/lib/this-week/types'
import s from './overview.module.css'
import A4Sheet from './A4Sheet'
import Masthead from './Masthead'
import WeekInBrief from './WeekInBrief'
import DivisionsBlock from './DivisionsBlock'
import DepartmentChart from './DepartmentChart'
import MostAskedSubjects from './MostAskedSubjects'
import TopQuestions from './TopQuestions'
import Feature from './Feature'
import MostActiveFooter from './MostActiveFooter'

// One-A4 space budget: a page carrying the week-in-brief, or a week with a
// heavy division count, runs denser, so the aggregate sections tighten. The
// heavy-week caps are new, more conservative values verified by the visual gate.
const CHART_CAP_WITH_BRIEF = 5
const CHART_CAP_HEAVY = 8
const TOPICS_CAP_WITH_BRIEF = 5
const TOPICS_CAP_HEAVY = 6
const TOPICS_CAP = 10
const QA_MAX_DENSE = 2
const QA_MAX = 3
const HEAVY_DIVISIONS_THRESHOLD = 6

export default function Overview({ digest, week }: { digest: DigestData; week: string }) {
  const ov = digest.overview
  const headline = ov?.headline || digest.headline || (digest.mode === 'recess' ? 'Parliament in recess' : digest.windowLabel)
  const intro = ov?.intro || digest.intro || ''
  const hasBrief = Boolean(ov?.brief?.length)
  const hasData = Boolean(digest.highlights?.votes?.length || digest.departments?.length)
  const dense = hasBrief || digest.highlights.votes.length > HEAVY_DIVISIONS_THRESHOLD
  const chartCap = hasBrief ? CHART_CAP_WITH_BRIEF : dense ? CHART_CAP_HEAVY : undefined
  const topicsCap = hasBrief ? TOPICS_CAP_WITH_BRIEF : dense ? TOPICS_CAP_HEAVY : TOPICS_CAP
  const qa = (digest.qa ?? []).slice(0, dense ? QA_MAX_DENSE : QA_MAX)
  const feature = ov?.feature ?? digest.feature

  return (
    <A4Sheet>
      <Masthead
        week={week}
        windowLabel={digest.windowLabel}
        headline={headline}
        stats={digest.stats}
        hasFull={Boolean(digest.body?.length)}
      />
      {intro && <p className={s.topstory}>{intro}</p>}
      {hasBrief && <WeekInBrief items={ov!.brief!} />}
      {hasData && (
        <div className={s.cols2}>
          <div>
            <h3 className={s.sectionTitle}>The divisions, closest first</h3>
            <DivisionsBlock votes={digest.highlights.votes} />
          </div>
          <div>
            <h3 className={s.sectionTitle}>Written questions, by department</h3>
            <DepartmentChart departments={digest.departments} cap={chartCap} />
          </div>
        </div>
      )}
      {hasData && <MostAskedSubjects topics={digest.topTopics} cap={topicsCap} />}
      {hasData && qa.length > 0 && <TopQuestions qa={qa} />}
      {hasData && feature && <Feature feature={feature} />}
      {hasData && ov?.mostActive && <MostActiveFooter mostActive={ov.mostActive} />}
      <div className={s.credit}>Every figure checked against the official Parliament record. henceforth.club</div>
    </A4Sheet>
  )
}
