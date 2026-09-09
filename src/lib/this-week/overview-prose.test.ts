import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'content/this-week')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

/** The house rule is no em dash anywhere in the writing, and no colon
 *  introducing a clause. Until 2026-09-09 this file read three fields of the
 *  overview, so the rule held there and nowhere else: the 9 September issue
 *  reached Henry carrying twenty three em dashes in its body, its vote blurbs
 *  and its feature, none of which were being read. Every prose field is read
 *  now.
 *
 *  The strict pass starts at STRICT_FROM rather than reaching backwards.
 *  Fifteen issues are already published, together carrying nearly three hundred
 *  em dashes, and each has a rendered sheet on the site; rewriting printed
 *  history is Henry's call, not a test's. Earlier issues keep the original
 *  three-field check, so nothing that used to pass starts failing. */
const STRICT_FROM = '2026-09-09'

interface Blurbed { blurb?: string }

function overviewFields(digest: Record<string, any>): string[] {
  const overview = digest.overview ?? {}
  return [
    overview.intro,
    ...(overview.brief ?? []).map((b: { note: string }) => b.note),
    overview.feature?.summary,
  ].filter(Boolean)
}

/** Every field a reader actually reads as prose. Titles, headings and dates are
 *  data and are deliberately not included. */
function allProseFields(digest: Record<string, any>): string[] {
  const highlights = digest.highlights ?? {}
  return [
    ...overviewFields(digest),
    digest.intro,
    digest.headline,
    ...(digest.body ?? []),
    ...(digest.feature?.questions ?? []).map((q: unknown) => (typeof q === 'string' ? q : (q as Blurbed)?.blurb)),
    ...(highlights.votes ?? []).map((v: Blurbed) => v?.blurb),
    ...(highlights.bills ?? []).map((b: Blurbed) => b?.blurb),
    ...(highlights.questions ?? []).map((q: unknown) => (typeof q === 'string' ? q : (q as Blurbed)?.blurb)),
    ...(digest.qa ?? []).flatMap((x: { question?: string; answer?: string }) => [x?.question, x?.answer]),
  ].filter((x): x is string => typeof x === 'string' && x.length > 0)
}

describe('overview prose is plain English', () => {
  for (const file of files) {
    const digest = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    if (!digest.overview) continue
    const strict = file.slice(0, 10) >= STRICT_FROM
    const fields = strict ? allProseFields(digest) : overviewFields(digest)
    it(`${file} carries no em-dash and no connector colon${strict ? ' in any prose field' : ''}`, () => {
      for (const text of fields) {
        expect(text).not.toMatch(/—/)
        expect(text).not.toMatch(/: [a-z]/)   // a colon introducing a clause; "Roads: Temperature" headings are data, not prose, and are not checked
      }
    })
  }
  it('the strict pass reads more than the three overview fields', () => {
    const digest = JSON.parse(readFileSync(join(dir, `${STRICT_FROM}.json`), 'utf8'))
    expect(allProseFields(digest).length).toBeGreaterThan(overviewFields(digest).length)
  })
})
