import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, publishRefusal, sheetPath } from './render-draft-core.mjs'

// The publishing step of Hansard 1.10's sheet path: `render-draft.mjs <week>
// --publish` writes public/this-week/<week>.pdf, the address the Hansard app
// fetches. A draft's copy is review-gated, so a draft must never land there.
// These pin the decision without Chrome or a dev server.

const HERE = '/repo/scripts/this-week'

describe('parseArgs', () => {
  it('reads the week as the bare argument and defaults to a local review render', () => {
    expect(parseArgs(['2026-08-19'])).toEqual({
      week: '2026-08-19', base: 'http://localhost:3000', out: null, publish: false,
    })
  })

  it('reads --publish, --base and --out in any order', () => {
    expect(parseArgs(['--publish', '2026-08-19', '--base', 'http://localhost:3001', '--out', '/tmp/x.pdf'])).toEqual({
      week: '2026-08-19', base: 'http://localhost:3001', out: '/tmp/x.pdf', publish: true,
    })
  })
})

describe('publishRefusal — a draft must not become a sheet', () => {
  it('refuses --publish on a draft, naming the file and the flip it wants', () => {
    expect(publishRefusal('2026-09-02', { status: 'draft' }, true))
      .toBe('content/this-week/2026-09-02.json is still a draft — flip status to "published" before --publish')
  })

  it('refuses --publish on a digest with no status at all — only "published" opens the door', () => {
    expect(publishRefusal('2026-09-02', {}, true)).not.toBeNull()
  })

  it('lets a published week through', () => {
    expect(publishRefusal('2026-08-19', { status: 'published' }, true)).toBeNull()
  })

  it('never refuses a review render — a draft is exactly what the preview is for', () => {
    expect(publishRefusal('2026-09-02', { status: 'draft' }, false)).toBeNull()
  })
})

describe('sheetPath — where the render lands', () => {
  it('--publish writes the public address the Hansard app fetches', () => {
    expect(sheetPath({ week: '2026-08-19', out: null, publish: true }, HERE))
      .toBe('/repo/public/this-week/2026-08-19.pdf')
  })

  it('a review render stays local under scripts/this-week/preview, which is gitignored', () => {
    expect(sheetPath({ week: '2026-09-02', out: null, publish: false }, HERE))
      .toBe('/repo/scripts/this-week/preview/2026-09-02.pdf')
  })

  it('--out wins over both', () => {
    expect(sheetPath({ week: '2026-08-19', out: '/tmp/x.pdf', publish: true }, HERE)).toBe('/tmp/x.pdf')
  })
})

describe('render-draft.mjs', () => {
  it('asks the refusal before it reaches for the dev server or Chrome', () => {
    const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'render-draft.mjs'), 'utf8')
    const refusal = script.indexOf('publishRefusal(')
    expect(refusal).toBeGreaterThan(-1)
    expect(refusal).toBeLessThan(script.indexOf('await fetch('))
    expect(refusal).toBeLessThan(script.indexOf('puppeteer.launch('))
  })
})
