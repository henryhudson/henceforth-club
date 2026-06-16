// Build a plain-text review email from a This Week in Parliament digest JSON.
// Usage: node email-body.mjs content/this-week/2026-06-17.json
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) { console.error('usage: email-body.mjs <digest.json>'); process.exit(1) }
const d = JSON.parse(readFileSync(path, 'utf8'))

const L = []
L.push(d.headline ?? d.windowLabel)
L.push('='.repeat((d.headline ?? d.windowLabel).length))
L.push('')
L.push(`Window: ${d.windowLabel}    Mode: ${d.mode}    Status: ${d.status}`)
L.push(`${d.stats.divisions} divisions · ${d.stats.questions} written questions · ${d.stats.distinctAskers} askers`)
L.push('')
if (d.intro) { L.push(d.intro); L.push('') }
if (d.feature) {
  L.push(`TOP STORY — ${d.feature.title}`)
  L.push('-'.repeat(40))
  if (d.feature.summary) L.push(d.feature.summary)
  L.push('')
}
if (d.highlights?.votes?.length) {
  L.push('Divisions:')
  for (const v of d.highlights.votes) L.push(`  • ${v.row.title} — ${v.row.ayes}/${v.row.noes} (${v.row.date})`)
  L.push('')
}
if (d.highlights?.bills?.length) {
  L.push('Bills:')
  for (const b of d.highlights.bills) L.push(`  • ${b.row.title} — ${b.row.stage} [${b.row.house}]`)
  L.push('')
}
L.push('—'.repeat(20))
L.push(`File:   content/this-week/${d.week}.json`)
L.push(`Review: this email, or the JSON on GitHub. The /hansard/this-week/${d.week} page 404s`)
L.push(`        while status is "draft" — publishing is what makes it render.`)
L.push('')
L.push(`To PUBLISH: change "status": "draft" to "published" in that file and push to main.`)
console.log(L.join('\n'))
