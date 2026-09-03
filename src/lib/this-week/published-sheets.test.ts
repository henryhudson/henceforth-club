import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { DigestData } from './types'

// The sheet contract the Hansard app depends on (1.10): a published week's
// sheet is at public/this-week/<week>.pdf, the address the app fetches, and a
// draft has no sheet there, because a draft's copy is review-gated and the
// render refuses to publish one. Pinned over the committed files themselves,
// so a status flipped without a render, or a sheet rendered from a draft,
// fails the gate before a push deploys it.
const CONTENT_DIR = path.join(process.cwd(), 'content', 'this-week')
const SHEET_DIR = path.join(process.cwd(), 'public', 'this-week')

const weeks = fs
  .readdirSync(CONTENT_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => ({
    week: f.replace('.json', ''),
    status: (JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')) as DigestData).status,
  }))
const published = weeks.filter(w => w.status === 'published')
const drafts = weeks.filter(w => w.status !== 'published')
const sheetOf = (week: string) => path.join(SHEET_DIR, `${week}.pdf`)

describe('the published sheets', () => {
  it('cover every published week — the app fetches public/this-week/<week>.pdf', () => {
    for (const { week } of published) {
      expect(fs.existsSync(sheetOf(week)), `${week} is published but has no sheet`).toBe(true)
    }
  })

  it('are PDF files, not an error page saved under the name', () => {
    for (const { week } of published) {
      const head = Buffer.alloc(5)
      const fd = fs.openSync(sheetOf(week), 'r')
      fs.readSync(fd, head, 0, 5, 0)
      fs.closeSync(fd)
      expect(head.toString('latin1'), week).toBe('%PDF-')
    }
  })

  it('include no draft — the render refuses to publish one', () => {
    for (const { week } of drafts) {
      expect(fs.existsSync(sheetOf(week)), `${week} is a draft but a sheet is committed`).toBe(false)
    }
  })
})
