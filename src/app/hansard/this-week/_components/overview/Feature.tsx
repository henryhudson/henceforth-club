import type { OverviewBlock } from '@/lib/this-week/types'
import { trimSentences } from '@/lib/this-week/overview'
import s from './overview.module.css'

interface FeatureProps {
  feature: NonNullable<OverviewBlock['feature']>
}

export default function Feature({ feature }: FeatureProps) {
  return (
    <div className={s.feature}>
      <div className={s.fk}>Feature</div>
      <h4>{feature.title.replace(/\s+[—–]\s+/g, ', ')}</h4>
      <p>{trimSentences(feature.summary, 3)}</p>
    </div>
  )
}
