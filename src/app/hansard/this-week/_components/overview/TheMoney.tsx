import type { MoneyItem } from '@/lib/this-week/types'
import s from './overview.module.css'

/** The week's public money, largest sum first. Every figure is quoted from a
 *  minister's own written answer, so the column carries the same standard of
 *  proof as the rest of the sheet. */
export default function TheMoney({ items }: { items: MoneyItem[] }) {
  if (items.length === 0) return null
  return (
    <>
      <h3 className={s.sectionTitle}>The money, and what it is for</h3>
      {items.map((m, i) => (
        <div key={i} className={s.moneyRow}>
          <span className={s.moneyAmount}>{m.amount}</span>
          <p className={s.moneyPurpose}>
            <span className={s.moneyDept}>{m.department}</span>
            {m.purpose}
          </p>
        </div>
      ))}
    </>
  )
}
