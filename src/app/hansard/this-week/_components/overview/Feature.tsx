import type { OverviewBlock } from '@/lib/this-week/types'
import s from './overview.module.css'

interface FeatureProps {
  feature: NonNullable<OverviewBlock['feature']>
}

// The big square at the page foot carries the whole summary — the A4Sheet
// fit loop, not sentence-trimming, is what holds the sheet to one page now.
export default function Feature({ feature }: FeatureProps) {
  return (
    <div className={s.feature}>
      <div className={s.fk}>The feature</div>
      <h4>{feature.title.replace(/\s+[—–]\s+/g, ', ')}</h4>
      <p>{feature.summary}</p>
    </div>
  )
}
