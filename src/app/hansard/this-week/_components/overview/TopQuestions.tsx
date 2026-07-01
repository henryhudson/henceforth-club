import type { QAItem } from '@/lib/this-week/types'
import { trimSentences } from '@/lib/this-week/overview'
import s from './overview.module.css'

interface TopQuestionsProps {
  qa: QAItem[]
}

export default function TopQuestions({ qa }: TopQuestionsProps) {
  if (!qa.length) return null
  return (
    <>
      <h3 className={s.sectionTitle}>A sample of the week&rsquo;s questions</h3>
      <div className={s.qa} style={{ gridTemplateColumns: `repeat(${qa.length}, 1fr)` }}>
        {qa.map((q, i) => (
          <div key={i} className={s.qitem}>
            <div className={s.qh}>
              {q.heading} <span className={s.qwho}>· {q.asker}{q.party ? `, ${q.party}` : ''}</span>
            </div>
            <div className={s.qq}>{q.question}</div>
            <div className={s.qans}><b>The answer</b> {trimSentences(q.answer, 2)}</div>
          </div>
        ))}
      </div>
    </>
  )
}
