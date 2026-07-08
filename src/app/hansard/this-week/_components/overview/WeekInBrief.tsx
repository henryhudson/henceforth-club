import type { BriefItem } from '@/lib/this-week/types'
import s from './overview.module.css'

interface WeekInBriefProps {
  items: BriefItem[]
}

export default function WeekInBrief({ items }: WeekInBriefProps) {
  if (!items.length) return null
  return (
    <>
      <h3 className={s.sectionTitle}>The week in brief</h3>
      <div className={s.brief}>
        {items.map((item, i) => (
          <div key={i} className={s.bitem}>
            <span className={s.ih}>{item.title}, {item.when}.</span> {item.note}
          </div>
        ))}
      </div>
    </>
  )
}
