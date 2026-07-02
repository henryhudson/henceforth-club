// One-time backfill: write the plain-English `overview` block into existing digests.
// Usage: node scripts/this-week/backfill-overview.mjs <week> [<week>…]
//
// The block is spliced into the file text just above the "highlights" key
// (matching the field order in src/lib/this-week/types.ts) so every existing
// byte stays untouched and the diff shows only the added block.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeMostActive } from './compute-most-active.mjs'

const CONTENT_DIR = join(process.cwd(), 'content/this-week')
const REWRITES_PATH = join(process.cwd(), 'docs/superpowers/plans/2026-07-01-overview-rewrites.json')

const isDressedUp = (headline) => /—/.test(headline) || /: [a-z]/.test(headline)

function isoMinusDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildBrief(tuples) {
  return tuples.map(([heading, note]) => {
    const i = heading.lastIndexOf(',')
    return { title: heading.slice(0, i).trim(), when: heading.slice(i + 1).trim(), note }
  })
}

const ANCHOR = '\n  "highlights": {'

function splice(raw, overview) {
  if (raw.includes('"overview"')) throw new Error('digest already carries an overview block')
  const anchorAt = raw.indexOf(ANCHOR)
  if (anchorAt === -1) throw new Error('no "highlights" anchor found in digest')
  const block = JSON.stringify(overview, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : '  ' + line))
    .join('\n')
  return raw.slice(0, anchorAt) + `\n  "overview": ${block},` + raw.slice(anchorAt)
}

async function backfillWeek(week, rewrites) {
  const entry = rewrites[week]
  if (!entry || !entry.intro) {
    console.warn(`skip ${week}: no rewrites entry with an intro`)
    return
  }

  const filePath = join(CONTENT_DIR, `${week}.json`)
  const raw = readFileSync(filePath, 'utf8')
  const digest = JSON.parse(raw)

  const digestHeadline = digest.headline || ''
  const headline = isDressedUp(digestHeadline) && entry.headline ? entry.headline : digestHeadline

  const overview = { headline, intro: entry.intro }

  if (entry.brief?.length) overview.brief = buildBrief(entry.brief)

  if (digest.feature) {
    overview.feature = { title: digest.feature.title, summary: entry.featureSummary || digest.feature.summary }
  }

  const fromISO = isoMinusDays(week, 7)
  console.log(`  computing most active for ${week} (${fromISO} to ${week})…`)
  const mostActive = await computeMostActive(fromISO, week)
  if (mostActive) overview.mostActive = mostActive

  writeFileSync(filePath, splice(raw, overview))
  console.log(`  wrote overview block for ${week}`)
}

const weeks = process.argv.slice(2)
if (!weeks.length) {
  console.error('usage: node backfill-overview.mjs <week> [<week>…]')
  process.exit(1)
}

const rewrites = JSON.parse(readFileSync(REWRITES_PATH, 'utf8'))
for (const week of weeks) {
  console.log(`${week}:`)
  await backfillWeek(week, rewrites)
}
