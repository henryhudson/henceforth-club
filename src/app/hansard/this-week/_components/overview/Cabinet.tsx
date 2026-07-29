import type { CabinetPost } from '@/lib/this-week/types'
import s from './overview.module.css'

interface CabinetProps {
  title: string
  note?: string
  posts: CabinetPost[]
}

/** The government of the day as a graphic.
 *
 *  Two bands, because a reader scans a cabinet in two passes. The great offices
 *  come first, large enough to read at a glance; everything else follows as a
 *  dense office-and-name list. A flat alphabetical table would be accurate and
 *  useless — nobody looks up the Chancellor in the same motion as the Chief Whip.
 */
export default function Cabinet({ title, note, posts }: CabinetProps) {
  if (!posts.length) return null
  const great = posts.filter((p) => p.great)
  const rest = posts.filter((p) => !p.great)

  return (
    <>
      <h3 className={s.sectionTitle}>{title}</h3>
      {note && <p className={s.cabNote}>{note}</p>}

      {great.length > 0 && (
        <div className={s.cabGreat}>
          {great.map((p) => (
            <div key={p.office} className={s.cabGreatItem}>
              <span className={s.cabGreatName}>{p.name}</span>
              <span className={s.cabGreatOffice}>{p.office}</span>
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className={s.cabRest}>
          {rest.map((p) => (
            <div key={p.office} className={s.cabRow}>
              <span className={s.cabOffice}>{p.office}</span>
              <span className={s.cabName}>{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
