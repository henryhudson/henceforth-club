import type { VacancyBlock } from '@/lib/this-week/types'
import { pollWindow } from '@/lib/this-week/byelection'
import s from './overview.module.css'

const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const day = (iso: string) => new Date(`${iso}T12:00:00Z`)

/** The seat that is empty: when it fell vacant, and when the poll would fall
 *  for each day the writ might be moved. The dates are the statute's own
 *  arithmetic, not a forecast — a writ received on a given day fixes a window
 *  21 to 27 working days later, and the one Thursday inside it is polling day. */
export default function Vacancy({ vacancy }: { vacancy: VacancyBlock }) {
  const rows = vacancy.writScenarios.map((sc) => {
    const w = pollWindow(sc.writISO, vacancy.bankHolidays)
    return { label: sc.label, writISO: sc.writISO, poll: w.thursdays[0] ?? null, latest: w.latest }
  })

  return (
    <>
      <h3 className={s.sectionTitle}>The seat that is empty</h3>
      <p className={s.vacancySeat}>
        <b>{vacancy.seat}</b>, vacant since {LONG.format(day(vacancy.sinceISO))}, when {vacancy.member} left the
        House {vacancy.reason}. {vacancy.writMoved ? 'The writ has been moved.' : 'No writ has been moved.'}
      </p>
      <ol className={s.vacancyList}>
        {rows.map((r) => (
          <li key={r.writISO} className={s.vacancyRow}>
            <span className={s.vacancyWhen}>{r.label}</span>
            <span className={s.vacancyRule} aria-hidden />
            <span className={s.vacancyPoll}>{r.poll ? SHORT.format(day(r.poll)) : `by ${SHORT.format(day(r.latest))}`}</span>
          </li>
        ))}
      </ol>
      <p className={s.vacancyRuleNote}>
        Nothing in statute obliges the House to move the writ, and by convention a Member of the party that held
        the seat chooses the day. Once it is received the poll follows 21 to 27 working days later, a window wide
        enough to hold a Thursday whenever the writ is moved.
      </p>
    </>
  )
}
