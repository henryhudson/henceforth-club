import type { DepartmentSlice } from '@/lib/this-week/types'

const MAX_BARS = 10

interface Props {
  departments: DepartmentSlice[]
}

/** Inline-SVG horizontal bar chart of parliamentary written-question volume by department. */
export default function DepartmentChart({ departments }: Props) {
  if (departments.length === 0) return null

  const sorted = [...departments].sort((a, b) => b.count - a.count)
  const top = sorted.slice(0, MAX_BARS)
  const othersCount = sorted.slice(MAX_BARS).reduce((sum, d) => sum + d.count, 0)

  const rows: DepartmentSlice[] = [
    ...top,
    ...(othersCount > 0 ? [{ department: 'Others', count: othersCount }] : []),
  ]

  const maxCount = rows[0]?.count ?? 1
  const BAR_HEIGHT = 20
  const ROW_GAP = 10
  const LABEL_WIDTH = 310
  const CHART_WIDTH = 460
  const COUNT_WIDTH = 50
  const rowH = BAR_HEIGHT + ROW_GAP
  const svgHeight = rows.length * rowH
  const svgWidth = LABEL_WIDTH + CHART_WIDTH + COUNT_WIDTH

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        aria-label="Written questions by government department"
        role="img"
        className="w-full max-w-2xl"
        style={{ fontFamily: 'var(--font-space-mono), ui-monospace, monospace' }}
      >
        {rows.map((d, i) => {
          const y = i * rowH
          const barW = Math.max(2, (d.count / maxCount) * CHART_WIDTH)
          const isOthers = d.department === 'Others'
          // Truncate long department names
          const label =
            d.department.length > 40
              ? d.department.slice(0, 38) + '…'
              : d.department

          return (
            <g key={d.department}>
              {/* Label */}
              <text
                x={LABEL_WIDTH - 8}
                y={y + BAR_HEIGHT / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill={isOthers ? '#a8a29e' : '#44403c'}
              >
                {label}
              </text>
              {/* Bar track */}
              <rect
                x={LABEL_WIDTH}
                y={y + 2}
                width={CHART_WIDTH}
                height={BAR_HEIGHT - 4}
                fill="#ece9e4"
                rx={3}
              />
              {/* Bar fill */}
              <rect
                x={LABEL_WIDTH}
                y={y + 2}
                width={barW}
                height={BAR_HEIGHT - 4}
                fill={isOthers ? '#d6d3d1' : '#047857'}
                rx={3}
                opacity={isOthers ? 0.7 : 0.9}
              />
              {/* Count */}
              <text
                x={LABEL_WIDTH + CHART_WIDTH + 8}
                y={y + BAR_HEIGHT / 2 + 1}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={9}
                fill={isOthers ? '#a8a29e' : '#78716c'}
              >
                {d.count.toLocaleString()}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
