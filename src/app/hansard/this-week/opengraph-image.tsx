import { ImageResponse } from 'next/og'
import { ogSize, ogContentType } from '@/lib/og'
import { listPublishedDigests } from '@/lib/this-week/store'

export const size = ogSize
export const contentType = ogContentType
export const alt = 'This Week in Parliament — the weekly archive'

const INK = '#1c1a16'
const MUTED = '#6b6358'
const ACCENT = '#047857'
const BG = '#faf9f6'

// Stable directory card for /hansard/this-week. Unlike a single week's card, this
// represents the archive itself and never tracks "latest" — so a link shared to the
// bare URL stays a directory preview instead of silently becoming a different article.
export default function OG() {
  const count = listPublishedDigests().length

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: ACCENT }} />
          <div style={{ fontSize: 22, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase' }}>
            This Week in Parliament
          </div>
        </div>

        {/* Title + tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, lineHeight: 1.05, color: INK }}>
            The weekly archive
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: MUTED, maxWidth: 1000 }}>
            Every issue of what the House of Commons voted on and was asked.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, color: MUTED }}>
          <div style={{ display: 'flex' }}>henceforth.club</div>
          <div style={{ display: 'flex', color: ACCENT }}>
            {count > 0 ? `${count} issues · /hansard/this-week` : '/hansard/this-week'}
          </div>
        </div>
      </div>
    ),
    ogSize
  )
}
