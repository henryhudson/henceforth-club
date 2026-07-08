import type { DigestData } from '@/lib/this-week/types'
import { prepareDivisions } from '@/lib/this-week/overview'
import s from './overview.module.css'

interface DivisionsBlockProps {
  votes: DigestData['highlights']['votes']
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function DivisionsBlock({ votes }: DivisionsBlockProps) {
  const prepared = prepareDivisions(votes)

  if (prepared.mode === 'none') {
    return <p className={s.none}>No divisions were held this week.</p>
  }

  // Mirrors prepareDivisions' own stable sort-by-margin, so datesByMargin[i]
  // lines up with prepared.items[i] without duplicating its title/tally logic.
  const datesByMargin = votes
    .map(v => ({ margin: Math.abs(v.row.ayes - v.row.noes), date: v.row.date }))
    .sort((a, b) => a.margin - b.margin)

  const dayMonth = (index: number, day: number) => {
    const iso = datesByMargin[index]?.date
    const month = iso ? MONTHS[parseInt(iso.slice(5, 7), 10) - 1] : undefined
    return month ? `${day} ${month}` : `${day}`
  }

  if (prepared.mode === 'pills') {
    return (
      <div className={s.divs}>
        {prepared.items.map((x, i) => (
          <div key={i} className={x.carried ? s.dpill : `${s.dpill} ${s.no}`}>
            <div className={s.dt}>{x.title}</div>
            <div className={s.dbar}>
              <span className={s.ay} style={{ width: `${x.ayesPct.toFixed(1)}%` }}>{x.ayes}</span>
              <span className={s.no} style={{ width: `${(100 - x.ayesPct).toFixed(1)}%` }}>{x.noes}</span>
            </div>
            <div className={s.dr}>
              <b>{x.carried ? 'Carried' : 'Not carried'}</b> by {x.margin} on {dayMonth(i, x.day)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={s.drows}>
      {prepared.items.map((x, i) => (
        <div key={i} className={s.drow}>
          <span className={s.rt} title={x.title}>{x.title}</span>
          <span className={s.rbar}>
            <i className={s.ay} style={{ width: `${x.ayesPct.toFixed(1)}%` }} />
            <i className={s.no} style={{ width: `${(100 - x.ayesPct).toFixed(1)}%` }} />
          </span>
          <span className={s.rtl}>{x.ayes}<span className={s.dash}>–</span>{x.noes}</span>
        </div>
      ))}
      {prepared.overflow > 0 && (
        <div className={`${s.drow} ${s.more}`}>
          and {prepared.overflow} more{prepared.overflowAllCarried ? ', all carried by wide margins' : ''}
        </div>
      )}
    </div>
  )
}
