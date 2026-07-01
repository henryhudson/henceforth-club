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

// One-A4 space budget: a page carrying the week-in-brief runs denser, so the
// aggregate sections tighten (the shipped static editions use the same numbers).
const CHART_CAP_WITH_BRIEF = 5
const TOPICS_CAP_WITH_BRIEF = 5
const TOPICS_CAP = 10
const QA_MAX_WITH_BRIEF = 2
const QA_MAX = 3

export default function Overview({ digest, week }: { digest: DigestData; week: string }) {
  const ov = digest.overview
  const headline = ov?.headline || digest.headline || (digest.mode === 'recess' ? 'Parliament in recess' : digest.windowLabel)
  const intro = ov?.intro || digest.intro || ''
  const hasBrief = Boolean(ov?.brief?.length)
  const hasData = Boolean(digest.highlights?.votes?.length || digest.departments?.length)
  const qa = (digest.qa ?? []).slice(0, hasBrief ? QA_MAX_WITH_BRIEF : QA_MAX)
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
            <DepartmentChart departments={digest.departments} cap={hasBrief ? CHART_CAP_WITH_BRIEF : undefined} />
          </div>
        </div>
      )}
      {hasData && <MostAskedSubjects topics={digest.topTopics} cap={hasBrief ? TOPICS_CAP_WITH_BRIEF : TOPICS_CAP} />}
      {hasData && qa.length > 0 && <TopQuestions qa={qa} />}
      {hasData && feature && <Feature feature={feature} />}
      {ov?.mostActive && <MostActiveFooter mostActive={ov.mostActive} />}
      <div className={s.credit}>Every figure checked against the official Parliament record. henceforth.club</div>
    </A4Sheet>
  )
}
