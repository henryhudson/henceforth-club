import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { DigestData } from './types'

// Content-integrity gate over the committed digests themselves. The 8 July and
// 15 July 2026 issues shipped highlight votes numbered 1..N — sequence numbers
// standing in for real Commons division identifiers — so every vote-row tap in
// the Hansard app replayed the wrong division. A real division identifier has
// been four digits for years; a small sequence number can only be a placeholder.
const CONTENT_DIR = path.join(process.cwd(), 'content', 'this-week')

const digests = fs
  .readdirSync(CONTENT_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')) as DigestData)

describe('committed digests', () => {
  it('carry real Commons division identifiers on every highlight vote, never sequence numbers', () => {
    for (const digest of digests) {
      for (const vote of digest.highlights.votes) {
        expect(vote.row.id, `${digest.week}: "${vote.row.title}"`).toBeGreaterThanOrEqual(1000)
      }
    }
  })

  it('never repeat a division identifier within one issue', () => {
    for (const digest of digests) {
      const ids = digest.highlights.votes.map(v => v.row.id)
      expect(new Set(ids).size, digest.week).toBe(ids.length)
    }
  })

  // The 29 July 2026 issue shipped its highlighted bills as bare rows — no
  // { row, blurb } wrapper — a shape the app's strict decoder rejects whole,
  // parking every fresh install's masthead on the 22 July issue. The gate
  // above was scoped to votes only, so bills and questions went unchecked.
  it('wrap every highlight in all three arrays as { row, blurb }, never bare rows', () => {
    for (const digest of digests) {
      for (const key of ['votes', 'questions', 'bills'] as const) {
        for (const [i, highlight] of digest.highlights[key].entries()) {
          expect(highlight?.row, `${digest.week}: highlights.${key}[${i}]`).toBeTypeOf('object')
          expect(highlight?.blurb, `${digest.week}: highlights.${key}[${i}]`).toBeTypeOf('string')
        }
      }
    }
  })
})
