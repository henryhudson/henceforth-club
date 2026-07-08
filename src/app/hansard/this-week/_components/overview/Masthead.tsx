import Link from 'next/link'
import type { DigestData } from '@/lib/this-week/types'
import s from './overview.module.css'

interface MastheadProps {
  week: string
  windowLabel: string
  headline: string
  stats: DigestData['stats']
  hasFull: boolean
}

export default function Masthead({ week, windowLabel, headline, stats, hasFull }: MastheadProps) {
  const label = windowLabel.replace(/\s*[–-]\s*/g, ' to ')
  return (
    <>
      <span className={s.badge}>HENCEFORTH.CLUB</span>
      <div className={s.kicker}>This Week in Parliament, {label}</div>
      <h1 className={s.headline}>{headline}</h1>
      <div className={s.stats}>
        <b>{stats.divisions}</b> divisions · <b>{stats.questions.toLocaleString()}</b> written questions ·{' '}
        <b>{stats.distinctAskers}</b> distinct askers
        {hasFull && (
          <>
            {' · '}
            <Link href={`/hansard/this-week/${week}/full`}>Read the full article</Link>
          </>
        )}
      </div>
    </>
  )
}
