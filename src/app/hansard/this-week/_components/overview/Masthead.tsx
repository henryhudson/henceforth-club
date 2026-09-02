import Headline from './Headline'
import Link from 'next/link'
import type { DigestData } from '@/lib/this-week/types'
import s from './overview.module.css'

interface MastheadProps {
  week: string
  windowLabel: string
  headline: string
  stats: DigestData['stats']
  mode: DigestData['mode']
  recessReturnISO: string | null
  hasFull: boolean
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function returnDate(iso: string | null): string | null {
  if (!iso) return null
  const day = parseInt(iso.slice(8, 10), 10)
  const month = MONTHS[parseInt(iso.slice(5, 7), 10) - 1]
  return month ? `${day} ${month}` : null
}

export default function Masthead({
  week, windowLabel, headline, stats, mode, recessReturnISO, hasFull,
}: MastheadProps) {
  const back = returnDate(recessReturnISO)
  const statsLine =
    mode === 'recess'
      ? 'In recess · no sittings this week'
      : `${stats.divisions} divisions · ${stats.questions.toLocaleString()} written questions · ${stats.distinctAskers} distinct askers`
  return (
    <>
      {/* The nameplate wears the same blackletter as the Morning Edition
          (Henry's word, 2026-08-19); Georgia stands in until the face loads. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap"
      />
      <div className={s.folio}>
        <span>This Week in Parliament · {windowLabel}</span>
        <span>{statsLine}</span>
        <span>
          {mode === 'recess' && back ? (
            <>The Commons returns {back}</>
          ) : hasFull ? (
            <Link href={`/hansard/this-week/${week}/full`}>Read the full article</Link>
          ) : (
            'henceforth.club'
          )}
        </span>
      </div>
      <div className={s.nameplate}>The Hansard</div>
      <div className={s.subtitle}>A weekly digest of the proceedings of the Parliament of the United Kingdom</div>
      <Headline>{headline}</Headline>
    </>
  )
}
