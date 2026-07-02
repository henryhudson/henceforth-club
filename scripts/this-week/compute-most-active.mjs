// Compute the week's busiest written-question asker and answering minister.
// Usage: node compute-most-active.mjs 2026-06-24 2026-07-01
const BASE = 'https://questions-statements-api.parliament.uk/api/writtenquestions/questions'
const url = (p, skip) => `${BASE}?${p}&house=Commons&expandMember=true&take=100&skip=${skip}`

async function pageAll(p) {
  const first = await (await fetch(url(p, 0))).json()
  const total = first.totalResults
  const out = (first.results || []).map(x => x.value)
  const skips = []
  for (let s = 100; s < total; s += 100) skips.push(s)
  for (let i = 0; i < skips.length; i += 6) {
    const batch = await Promise.all(skips.slice(i, i + 6).map(s => fetch(url(p, s)).then(r => r.json())))
    for (const r of batch) out.push(...(r.results || []).map(x => x.value))
  }
  return out
}

const tally = (rows, pick) => {
  const m = new Map()
  for (const r of rows) {
    const who = pick(r); if (!who || !who.name) continue
    const e = m.get(who.id) || { name: who.name, party: who.party, count: 0 }
    e.count++
    m.set(who.id, e)
  }
  return [...m.values()].sort((a, b) => b.count - a.count)
}

export async function computeMostActive(fromISO, toISO) {
  const tabled = await pageAll(`tabledWhenFrom=${fromISO}&tabledWhenTo=${toISO}`)
  const answered = await pageAll(`answeredWhenFrom=${fromISO}&answeredWhenTo=${toISO}`)
  const asker = tally(tabled, r => r.askingMember)[0]
  const answerer = tally(answered, r => r.answeringMember)[0]
  if (!asker || !answerer) return null
  return { asker, answerer }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [from, to] = process.argv.slice(2)
  if (!from || !to) { console.error('usage: node compute-most-active.mjs <fromISO> <toISO>'); process.exit(1) }
  console.log(JSON.stringify(await computeMostActive(from, to), null, 2))
}
