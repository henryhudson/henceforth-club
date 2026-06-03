import { ImageResponse } from 'next/og'
import { ogSize, ogContentType } from '@/lib/og'
import { loadLatestPublishedDigest } from '@/lib/this-week/store'

export const size = ogSize
export const contentType = ogContentType
export const alt = 'This Week in Parliament — Hansard digest'

const ACCENT = '#3da87a'
const ACCENT_GLOW = 'rgba(61, 168, 122, 0.22)'

export default function OG() {
  const digest = loadLatestPublishedDigest()

  const windowLabel = digest?.windowLabel ?? 'This Week in Parliament'
  const divisions = digest?.stats.divisions ?? 0
  const questions = digest?.stats.questions ?? 0
  const distinctAskers = digest?.stats.distinctAskers ?? 0

  // Top 5 departments for bar chart
  const departments = (digest?.departments ?? []).slice(0, 5)
  const maxCount = departments[0]?.count ?? 1

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: '#06080a',
          color: '#e6edf3',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          backgroundImage: `
            radial-gradient(circle at 0% 0%, ${ACCENT_GLOW}, transparent 45%),
            radial-gradient(circle at 100% 100%, ${ACCENT_GLOW}, transparent 55%),
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: 'auto, auto, 60px 60px, 60px 60px',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: ACCENT,
              boxShadow: `0 0 20px ${ACCENT}`,
            }}
          />
          <div style={{ fontSize: 22, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase' }}>
            henceforth.club / hansard
          </div>
        </div>

        {/* Main content: left = headline, right = bar chart */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 80, flex: 1, paddingTop: 48 }}>
          {/* Left: label + stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
            <div style={{ fontSize: 28, color: '#6b7280', letterSpacing: 2, textTransform: 'uppercase' }}>
              This Week in Parliament
            </div>
            <div
              style={{
                fontSize: 68,
                fontWeight: 700,
                lineHeight: 1.05,
                color: '#ffffff',
                letterSpacing: -1,
              }}
            >
              {windowLabel}
            </div>
            {/* Stat row */}
            {digest && digest.mode !== 'recess' && (
              <div style={{ display: 'flex', gap: 40, marginTop: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 44, fontWeight: 700, color: ACCENT }}>
                    {divisions}
                  </span>
                  <span style={{ fontSize: 16, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 2 }}>
                    Divisions
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 44, fontWeight: 700, color: ACCENT }}>
                    {questions.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 16, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 2 }}>
                    Questions
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 44, fontWeight: 700, color: ACCENT }}>
                    {distinctAskers}
                  </span>
                  <span style={{ fontSize: 16, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 2 }}>
                    Askers
                  </span>
                </div>
              </div>
            )}
            {digest?.mode === 'recess' && (
              <div style={{ fontSize: 32, color: '#6b7280', marginTop: 8 }}>
                Parliament is in recess
              </div>
            )}
          </div>

          {/* Right: department bar chart */}
          {departments.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                width: 340,
                paddingTop: 8,
              }}
            >
              <div style={{ fontSize: 14, color: '#4b5563', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
                Top Departments
              </div>
              {departments.map(d => {
                const pct = Math.round((d.count / maxCount) * 100)
                const short =
                  d.department.length > 28 ? d.department.slice(0, 26) + '…' : d.department
                return (
                  <div key={d.department} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{short}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          height: 8,
                          width: `${pct * 2.8}px`,
                          background: ACCENT,
                          borderRadius: 4,
                          opacity: 0.8,
                        }}
                      />
                      <span style={{ fontSize: 12, color: '#4b5563' }}>{d.count}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            color: '#6b7280',
          }}
        >
          <div>iOS · Henceforth Bitcoin Limited</div>
          <div style={{ color: ACCENT }}>/hansard/this-week</div>
        </div>
      </div>
    ),
    ogSize
  )
}
