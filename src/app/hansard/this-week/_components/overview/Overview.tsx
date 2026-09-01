import type { DigestData } from '@/lib/this-week/types'
import s from './overview.module.css'
import TheMoney from './TheMoney'
import A4Sheet from './A4Sheet'
import PackLayout, { Square } from './PackLayout'
import Masthead from './Masthead'
import WeekInBrief from './WeekInBrief'
import Cabinet from './Cabinet'
import Mayors from './Mayors'
import DivisionsBlock from './DivisionsBlock'
import DepartmentChart from './DepartmentChart'
import MostAskedSubjects from './MostAskedSubjects'
import TopQuestions from './TopQuestions'
import Feature from './Feature'
import MostActiveFooter from './MostActiveFooter'

// Four columns of packed squares. Each square is one column of type and
// continues into the next only when it cannot sit whole. Cabinet/mayors stay
// a full-width band because that graphic cannot go in one column. The
// A4Sheet fit loop still scales the hierarchy (6–8.5pt about a 7pt start).
const CHART_CAP = 8
const TOPICS_CAP = 10
const SIDE_BRIEF_MAX = 2

export default function Overview({ digest, week }: { digest: DigestData; week: string }) {
  const ov = digest.overview
  const headline = ov?.headline || digest.headline || (digest.mode === 'recess' ? 'Parliament in recess' : digest.windowLabel)
  const intro = digest.intro || ov?.intro || ''
  const money = ov?.money ?? []
  const brief = ov?.brief ?? []
  const hasData = Boolean(digest.highlights?.votes?.length || digest.departments?.length)
  // A recess week has no divisions to box beside the lead, so the sidebar
  // takes the first briefs instead — the register changes, usually.
  const sideBrief = !hasData ? brief.slice(0, SIDE_BRIEF_MAX) : []
  const restBrief = brief.slice(sideBrief.length)
  const qa = (digest.qa ?? []).slice(0, 1)
  const feature = ov?.feature ?? digest.feature
  const credit = 'Every figure checked against the official Parliament record. henceforth.club'

  return (
    <A4Sheet>
      <Masthead
        week={week}
        windowLabel={digest.windowLabel}
        headline={headline}
        stats={digest.stats}
        mode={digest.mode}
        recessReturnISO={digest.recessReturnISO}
        hasFull={Boolean(digest.body?.length)}
      />

      {/* The government of the day is a full-width graphic — it cannot sit in
          one column — so it stays a band above the packed squares. */}
      {(ov?.cabinet || ov?.mayors) && (
        <div className={s.band}>
          <div className={s.modFull}>
            {ov?.cabinet && <Cabinet title={ov.cabinet.title} note={ov.cabinet.note} posts={ov.cabinet.posts} />}
            {ov?.mayors && <Mayors title={ov.mayors.title} note={ov.mayors.note} seats={ov.mayors.seats} />}
          </div>
        </div>
      )}

      <PackLayout>
        {intro && (
          <Square id="lead" lead continues className={s.copy}>
            <p className={s.drop}>{intro}</p>
          </Square>
        )}
        {money.length > 0 && (
          <Square id="money">
            <TheMoney items={money} />
          </Square>
        )}
        {(hasData || sideBrief.length > 0) && (
          <Square id="side">
            {hasData ? (
              <>
                <h3 className={s.sectionTitle}>The divisions, closest first</h3>
                <DivisionsBlock votes={digest.highlights.votes} />
              </>
            ) : (
              sideBrief.map((item, i) => (
                <div key={i}>
                  <h3 className={s.sectionTitle}>{item.title}</h3>
                  <p className={s.sideNote}><b>{item.when}.</b> {item.note}</p>
                </div>
              ))
            )}
          </Square>
        )}
        {restBrief.length > 0 && (
          <Square id="brief">
            <WeekInBrief items={restBrief} />
          </Square>
        )}
        {hasData && (
          <Square id="departments">
            <h3 className={s.sectionTitle}>Written questions, by department</h3>
            <DepartmentChart departments={digest.departments} cap={CHART_CAP} />
            <MostAskedSubjects topics={digest.topTopics} cap={TOPICS_CAP} />
          </Square>
        )}
        {feature && (
          <Square id="feature">
            <Feature feature={feature} />
          </Square>
        )}
        {qa.length > 0 && (
          <Square id="qa" className={s.sq}>
            <TopQuestions qa={qa} />
          </Square>
        )}
        {ov?.mostActive && (
          <Square id="active" className={s.sq}>
            <h3 className={s.sectionTitle}>The most active</h3>
            <MostActiveFooter mostActive={ov.mostActive} />
          </Square>
        )}
      </PackLayout>

      <div className={s.credit}>
        Set in Georgia, seven point upon eight, the listings in agate · {credit}
      </div>
    </A4Sheet>
  )
}
