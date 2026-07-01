import type { DigestData } from '@/lib/this-week/types'
import s from './overview.module.css'

interface MostAskedSubjectsProps {
  topics: DigestData['topTopics']
  cap?: number
}

export default function MostAskedSubjects({ topics, cap = 10 }: MostAskedSubjectsProps) {
  if (!topics || !topics.length) return null
  const shown = topics.slice(0, cap)
  return (
    <>
      <h3 className={s.sectionTitle}>The most-asked subjects</h3>
      <div className={s.tts}>
        {shown.map((t, i) => (
          <span key={i} className={s.tt}><b>{t.count}</b> {t.heading}</span>
        ))}
      </div>
    </>
  )
}
