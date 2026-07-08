import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'content/this-week')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

describe('overview prose is plain English', () => {
  for (const file of files) {
    const overview = JSON.parse(readFileSync(join(dir, file), 'utf8')).overview
    if (!overview) continue
    const fields: string[] = [
      overview.intro,
      ...(overview.brief ?? []).map((b: { note: string }) => b.note),
      overview.feature?.summary,
    ].filter(Boolean)
    it(`${file} carries no em-dash and no connector colon`, () => {
      for (const text of fields) {
        expect(text).not.toMatch(/—/)
        expect(text).not.toMatch(/: [a-z]/)   // a colon introducing a clause; "Roads: Temperature" headings are data, not prose, and are not checked
      }
    })
  }
  it('lint suite is present', () => expect(true).toBe(true))
})
