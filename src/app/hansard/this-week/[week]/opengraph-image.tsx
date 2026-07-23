import { ImageResponse } from 'next/og'
import { ogSize, ogContentType } from '@/lib/og'
import { loadDigest, selectPublished } from '@/lib/this-week/store'

export const size = ogSize
export const contentType = ogContentType
export const alt = 'This Week in Parliament — Hansard digest'

const INK = '#1c1a16'
const MUTED = '#6b6358'
const ACCENT = '#047857'
const BG = '#faf9f6'

// One card per published week — the share preview for /hansard/this-week/{week}.
export default async function OG({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params
  // The same gate the page uses: a card for a week that 404s must say nothing
  // about it, or an unpublished issue is readable through its own share preview.
  const [digest] = selectPublished([loadDigest(week)])
  const windowLabel = digest?.windowLabel ?? ''
  const headline = digest?.headline ?? 'This Week in Parliament'
  const stats = digest?.stats
  const feature = digest?.feature
  const isRecess = digest?.mode === 'recess'

  // Scale the headline down as it gets longer so it never overflows the card.
  const titleSize = headline.length > 78 ? 48 : headline.length > 58 ? 54 : 62

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: BG,
          color: INK,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: ACCENT }} />
            <div style={{ fontSize: 22, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase' }}>
              This Week in Parliament
            </div>
          </div>
          <div style={{ fontSize: 22, color: MUTED }}>{windowLabel}</div>
        </div>

        {/* Headline + stats + story hook */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.08, color: INK, maxWidth: 1056 }}>
            {headline}
          </div>
          {stats && !isRecess && (
            <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>
              {stats.distinctAskers} MPs · {stats.questions.toLocaleString()} written questions · {stats.divisions} votes
            </div>
          )}
          {isRecess && (
            <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>Parliament is on recess 🏖️</div>
          )}
          {feature && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginTop: 6,
                padding: '16px 22px',
                borderRadius: 14,
                border: `2px solid rgba(4,120,87,0.25)`,
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 2, whiteSpace: 'nowrap' }}>
                Story of the week
              </div>
              <div style={{ display: 'flex', fontSize: 23, color: INK, maxWidth: 740 }}>
                {feature.title}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, color: MUTED }}>
          <div style={{ display: 'flex' }}>henceforth.club</div>
          <div style={{ display: 'flex', color: ACCENT }}>/hansard/this-week/{week}</div>
        </div>
      </div>
    ),
    ogSize
  )
}
