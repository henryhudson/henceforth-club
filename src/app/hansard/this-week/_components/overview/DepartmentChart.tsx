import { Fragment } from 'react'
import type { DigestData } from '@/lib/this-week/types'
import { shortenDept } from '@/lib/this-week/overview'
import s from './overview.module.css'

interface DepartmentChartProps {
  departments: DigestData['departments']
  cap?: number
}

const isOthers = (department: string) => /others?$/.test(shortenDept(department))

export default function DepartmentChart({ departments, cap = Infinity }: DepartmentChartProps) {
  if (!departments.length) return null

  let rows = departments
  if (rows.length > cap) {
    const head = rows.slice(0, cap).filter(x => !/others$/.test(x.department))
    const rest = rows.filter(x => !head.includes(x))
    const restCount = rest.reduce((sum, x) => sum + x.count, 0)
    const restDepts = rest.reduce((sum, x) => {
      const match = /^(\d+)/.exec(x.department)
      return sum + (match ? Number(match[1]) : 1)
    }, 0)
    rows = [...head, { department: `${restDepts} other departments`, count: restCount }]
  }

  // The aggregate ("N other departments") row must never set the scale —
  // it can dwarf every named department and flatten the rest of the chart.
  const named = rows.filter(x => !isOthers(x.department))
  const max = Math.max(...(named.length ? named : rows).map(x => x.count))

  return (
    <div className={s.chart}>
      {rows.map((x, i) => {
        const others = isOthers(x.department)
        const width = Math.min(100, (x.count / max) * 100).toFixed(1)
        return (
          <Fragment key={i}>
            <span className={s.bl}>{shortenDept(x.department)}</span>
            <span className={s.bt}>
              <i style={{ width: `${width}%`, opacity: others ? 0.3 : undefined }} />
            </span>
            <span className={s.bv}>{x.count.toLocaleString()}</span>
          </Fragment>
        )
      })}
    </div>
  )
}
