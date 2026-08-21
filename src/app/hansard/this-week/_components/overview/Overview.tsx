import type { DigestData } from '@/lib/this-week/types'
import s from './overview.module.css'
import A4Sheet from './A4Sheet'
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

// The modular page (design spec 2026-08-19): one big lead module across three
// legs with a boxed sidebar, then bands of ruled squares of varying widths,
// the feature square anchored at the page foot. The A4Sheet fit loop scales
// the whole hierarchy (6–8.5pt about a 7pt start) to fill exactly one sheet.
const CHART_CAP = 8
const TOPICS_CAP = 10
const SIDE_BRIEF_MAX = 2

export default function Overview({ digest, week }: { digest: DigestData; week: string }) {
  const ov = digest.overview
  const headline = ov?.headline || digest.headline || (digest.mode === 'recess' ? 'Parliament in recess' : digest.windowLabel)
  const intro = digest.intro || ov?.intro || ''
  const brief = ov?.brief ?? []
  const hasData = Boolean(digest.highlights?.votes?.length || digest.departments?.length)
  // A recess week has no divisions to box beside the lead, so the sidebar
  // takes the first briefs instead — the register changes, usually.
  const sideBrief = !hasData ? brief.slice(0, SIDE_BRIEF_MAX) : []
  const restBrief = brief.slice(sideBrief.length)
  const qa = (digest.qa ?? []).slice(0, 1)
  const feature = ov?.feature ?? digest.feature
  const credit = 'Every figure checked against the official Parliament record. henceforth.club'

  const footSquares = [
    qa.length > 0 && (
      <div key="qa" className={s.mod1}>
        <div className={s.sq}>
          <TopQuestions qa={qa} />
        </div>
      </div>
    ),
    ov?.mostActive && (
      <div key="active" className={s.mod1}>
        <div className={s.sq}>
          <h3 className={s.sectionTitle}>The most active</h3>
          <MostActiveFooter mostActive={ov.mostActive} />
        </div>
      </div>
    ),
  ].filter(Boolean)

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

      {/* Band A — the big lead module + boxed sidebar. A no-data issue with an
          empty brief has nothing to box, so the sidebar renders only when it
          has content and the lead takes the whole measure instead of leaving
          a blank ruled column. */}
      <div className={s.band}>
        <div className={hasData || sideBrief.length > 0 ? s.lead : s.leadFull}>
          <div className={s.legs3}>
            <p className={s.drop}>{intro}</p>
          </div>
        </div>
        {(hasData || sideBrief.length > 0) && (
          <aside className={s.side}>
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
          </aside>
        )}
      </div>

      {/* The government of the day, when the week redrew it */}
      {(ov?.cabinet || ov?.mayors) && (
        <div className={s.band}>
          <div className={s.modFull}>
            {ov?.cabinet && <Cabinet title={ov.cabinet.title} note={ov.cabinet.note} posts={ov.cabinet.posts} />}
            {ov?.mayors && <Mayors title={ov.mayors.title} note={ov.mayors.note} seats={ov.mayors.seats} />}
          </div>
        </div>
      )}

      {/* Band B — the week in brief beside the department listings */}
      {(restBrief.length > 0 || hasData) && (
        <div className={s.band}>
          {restBrief.length > 0 && (
            <div className={hasData ? s.mod2 : s.modFull}>
              <WeekInBrief items={restBrief} />
            </div>
          )}
          {hasData && (
            <div className={restBrief.length > 0 ? s.mod2 : s.modFull}>
              <h3 className={s.sectionTitle}>Written questions, by department</h3>
              <DepartmentChart departments={digest.departments} cap={CHART_CAP} />
              <MostAskedSubjects topics={digest.topTopics} cap={TOPICS_CAP} />
            </div>
          )}
        </div>
      )}

      {/* Band C — the squares at the page foot, the feature the big one */}
      {(feature || footSquares.length > 0) && (
        <div className={`${s.band} ${s.bandLast}`}>
          {feature && (
            <div className={footSquares.length === 0 ? s.mod3 : s.mod2}>
              <Feature feature={feature} />
            </div>
          )}
          {footSquares}
          {feature && footSquares.length < 2 && (
            <div className={s.mod1}>
              <div className={s.sq}>
                <h3 className={s.sectionTitle}>The record</h3>
                <p className={s.sideNote}>Every figure checked against the official Parliament record. Compiled from the Official Report, the written question record and the division lists, and rendered to one sheet for the week.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={s.credit}>
        Set in Georgia, seven point upon eight, the listings in agate · {credit}
      </div>
    </A4Sheet>
  )
}
