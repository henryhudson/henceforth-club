import type { OverviewBlock } from '@/lib/this-week/types'
import s from './overview.module.css'

interface MostActiveFooterProps {
  mostActive: NonNullable<OverviewBlock['mostActive']>
}

export default function MostActiveFooter({ mostActive }: MostActiveFooterProps) {
  const { asker, answerer } = mostActive
  return (
    <div className={s.funnote}>
      <p>{asker.name} asked more written questions than any other Member of Parliament this week with {asker.count}.</p>
      <p>{answerer.name} answered the most with {answerer.count}.</p>
    </div>
  )
}
