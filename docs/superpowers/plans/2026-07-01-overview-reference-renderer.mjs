import fs from 'node:fs'

const DIR = process.env.HOME + '/Programming/Main/henceforth-club/content/this-week'
const OUT = '/private/tmp/claude-501/-Users-henryhudson-Programming-Main-Hansard/59ccecd2-e8e0-4153-a26b-d20e5b1e89c6/scratchpad/overviews'
fs.mkdirSync(OUT, { recursive: true })
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const REWRITES = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-henryhudson-Programming-Main-Hansard/59ccecd2-e8e0-4153-a26b-d20e5b1e89c6/scratchpad/rewrites.json', 'utf8'))

const shortDept = (s) => s
  .replace('Department of Health and Social Care', 'Health').replace('Ministry of Defence', 'Defence')
  .replace('Ministry of Housing, Communities and Local Government', 'Housing').replace('Department for Transport', 'Transport')
  .replace('Department for Environment, Food and Rural Affairs', 'Environment').replace('Department for Education', 'Education')
  .replace('Department for Business and Trade', 'Business and Trade').replace('Department for Energy Security and Net Zero', 'Energy')
  .replace('Department for Work and Pensions', 'Work and Pensions')
  .replace('Foreign, Commonwealth and Development Office', 'Foreign Office').replace('Cabinet Office', 'Cabinet Office')
  .replace('Home Office', 'Home Office').replace('HM Treasury', 'Treasury').replace('Treasury', 'Treasury')
  .replace(/^(\d+) other departments$/, '$1 others')

const shortDiv = (t) => t.replace(/^Draft /, '').replace(/ 2026$/, '')
  .replace(/Customs \(Tariff and Miscellaneous Amendments\) \(No\. \d+\) Regulations/, 'Customs (Tariff) Regulations')
  .replace(/Climate Change Act 2008 \(International Aviation and International Shipping\) Regulations/, 'Climate Change Act, Aviation and Shipping')
  .replace(/Climate Change Act 2008 \(Credit Limit\) Order/, 'Climate Change Act, Credit Limit')
  .replace(/National Security \(State Threats\) Bill(?: Committee)? — /, 'National Security Bill, ')
  .replace(/National Security \(State Threats\) Bill(?: Committee)?/, 'National Security Bill')
  .replace(/Armed Forces Bill Report Stage — /, 'Armed Forces Bill, ')
  .replace(/Opposition Day — /, 'Opposition Day, ')
  .replace(/ — /g, ', ')

function divisions(votes) {
  if (!votes.length) return '<p class="none">No divisions were held this week.</p>'
  const divs = votes.map((v) => {
    const ayes = v.row.ayes, noes = v.row.noes, tot = ayes + noes || 1
    return { title: shortDiv(v.row.title), day: parseInt(v.row.date.slice(8), 10), ayes, noes, carried: ayes > noes, margin: Math.abs(ayes - noes), ap: ayes / tot * 100 }
  }).sort((a, b) => a.margin - b.margin)

  if (divs.length <= 6) {
    return '<div class="divs">' + divs.map((x) => `
      <div class="dpill ${x.carried ? 'ok' : 'no'}">
        <div class="dt">${esc(x.title)}</div>
        <div class="dbar"><span class="ay" style="width:${x.ap.toFixed(1)}%">${x.ayes}</span><span class="no" style="width:${(100 - x.ap).toFixed(1)}%">${x.noes}</span></div>
        <div class="dr"><b>${x.carried ? 'Carried' : 'Not carried'}</b> by ${x.margin} on ${x.day} June</div>
      </div>`).join('') + '</div>'
  }
  const cap = 16, shown = divs.slice(0, cap), rest = divs.slice(cap)
  let rows = shown.map((x) => `
    <div class="drow">
      <span class="rt" title="${esc(x.title)}">${esc(x.title)}</span>
      <span class="rbar"><i class="ay" style="width:${x.ap.toFixed(1)}%"></i><i class="no" style="width:${(100 - x.ap).toFixed(1)}%"></i></span>
      <span class="rtl">${x.ayes}<span class="dash">–</span>${x.noes}</span>
    </div>`).join('')
  if (rest.length) {
    const allCarried = rest.every((r) => r.carried)
    rows += `<div class="drow more">and ${rest.length} more${allCarried ? ', all carried by wide margins' : ''}</div>`
  }
  return '<div class="drows">' + rows + '</div>'
}

function chart(departments, cap = Infinity) {
  if (!departments.length) return ''
  let rows = departments
  if (rows.length > cap) {
    const head = rows.slice(0, cap).filter((x) => !/others$/.test(x.department))
    const rest = rows.filter((x) => !head.includes(x))
    const restCount = rest.reduce((s, x) => s + x.count, 0)
    const restDepts = rest.reduce((s, x) => s + (/^(\d+)/.test(x.department) ? +x.department.match(/^(\d+)/)[1] : 1), 0)
    rows = [...head, { department: `${restDepts} other departments`, count: restCount }]
  }
  const isOthers = (x) => /others?$/.test(shortDept(x.department))
  const named = rows.filter((x) => !isOthers(x))
  const max = Math.max(...(named.length ? named : rows).map((x) => x.count))   // aggregate row must not set the scale
  return '<div class="chart">' + rows.map((x) =>
    `<span class="bl">${esc(shortDept(x.department))}</span><span class="bt"><i style="width:${Math.min(100, x.count / max * 100).toFixed(1)}%${isOthers(x) ? ';opacity:.3' : ''}"></i></span><span class="bv">${x.count.toLocaleString()}</span>`).join('') + '</div>'
}

function topics(list, cap = 10) {
  if (!list || !list.length) return ''
  const items = list.slice(0, cap).map((t) => `<span class="tt"><b>${t.count}</b> ${esc(t.heading)}</span>`).join('')
  return `<h3>The most-asked subjects</h3><div class="tts">${items}</div>`
}

function feature(f) {
  if (!f || !f.title) return ''
  const parts = String(f.summary || '').split(/(?<=\.) /)
  const bal = (s) => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length
  let out = parts.slice(0, 3).join(' ')
  for (let i = 3; bal(out) > 0 && i < parts.length && i < 6; i++) out += ' ' + parts[i]  // extend to close any open bracket
  if (bal(out) > 0) out = out.slice(0, out.lastIndexOf('(')).trim()                       // or drop the unclosed opener
  return `<div class="feature"><div class="fk">Feature</div><h4>${esc(f.title.replace(/\s+[—–]\s+/g, ', '))}</h4><p>${esc(out)}</p></div>`
}

function brief(items) {
  if (!items || !items.length) return ''
  const rows = items.map(([h, t]) => `<div class="bitem"><span class="ih">${esc(h)}.</span> ${esc(t)}</div>`).join('')
  return `<h3>The week in brief</h3><div class="brief">${rows}</div>`
}

function trimAnswer(text, n) {
  const parts = String(text || '').split(/(?<=\.) /)
  const bal = (s) => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length
  let out = parts.slice(0, n).join(' ')
  for (let i = n; bal(out) > 0 && i < parts.length && i < n + 3; i++) out += ' ' + parts[i]
  if (bal(out) > 0) out = out.slice(0, out.lastIndexOf('(')).trim()
  return out
}

function questions(qa, max = 3) {
  if (!qa || !qa.length) return ''
  const picked = qa.slice(0, max)
  const items = picked.map((q) => `
    <div class="qitem">
      <div class="qh">${esc(q.heading)} <span class="qwho">· ${esc(q.asker)}${q.party ? ', ' + esc(q.party) : ''}</span></div>
      <div class="qq">${esc(q.question)}</div>
      <div class="qans"><b>The answer</b> ${esc(trimAnswer(q.answer, 2))}</div>
    </div>`).join('')
  return `<h3>A sample of the week's questions</h3><div class="qa" style="grid-template-columns:repeat(${picked.length},1fr)">${items}</div>`
}

const QMAX = { '2026-06-17': 2, '2026-06-24': 2 }   // heavy weeks: the one-page trim order

function renderOverview(d) {
  const label = d.windowLabel.replace(/\s*[–-]\s*/g, ' to ')
  const rw = REWRITES[d.week] || {}
  const intro = rw.intro || d.intro
  const headline = (/[—:]/.test(d.headline || '') && rw.headline) ? rw.headline : (d.headline || (d.mode === 'recess' ? 'Parliament in recess' : label))
  const feat = d.feature ? { ...d.feature, summary: rw.featureSummary || d.feature.summary } : d.feature
  const hasData = d.highlights.votes.length || d.departments.length
  const body = hasData ? `
    <div class="cols2">
      <div><h3>The divisions, closest first</h3>${divisions(d.highlights.votes)}</div>
      <div><h3>Written questions, by department</h3>${chart(d.departments, rw.brief ? 5 : Infinity)}</div>
    </div>
    ${topics(d.topTopics, rw.brief ? 5 : 10)}
    ${questions(rw.brief ? (d.qa || []).filter((q) => !/iron and steel/i.test(q.heading || '')) : d.qa, rw.brief ? 2 : (QMAX[d.week] ?? 3))}
    ${feature(feat)}`
    : ''

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(label)}</title>
<style>
  @page { size:A4; margin:0; } html,body { margin:0; background:#8a8a8a; } * { box-sizing:border-box; }
  .sheet { width:210mm; min-height:297mm; margin:0 auto; background:#fff; color:#141414; padding:9mm 14mm 6mm; font:10.5pt/1.4 Georgia,serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .draft { float:right; font:600 7pt/1 -apple-system,sans-serif; letter-spacing:.1em; color:#8a6d00; border:1px solid #cbb35a; border-radius:3px; padding:3px 6px; }
  .kicker { font:600 8.5pt/1 -apple-system,sans-serif; letter-spacing:.18em; text-transform:uppercase; color:#6b2b6b; }
  h1 { font-size:23pt; line-height:1.05; margin:3pt 0; letter-spacing:-.01em; }
  .stats { font:8.7pt/1 -apple-system,sans-serif; color:#555; border-top:2px solid #141414; border-bottom:.5px solid #aaa; padding:4pt 0; margin:0 0 6pt; }
  .stats b { color:#141414; }
  .topstory { font-size:10.4pt; line-height:1.37; margin:0 0 4pt; }
  .topstory::first-letter { font-size:220%; font-weight:700; line-height:.86; float:left; padding:3pt 5pt 0 0; color:#6b2b6b; }
  h3 { font:700 8.3pt/1 -apple-system,sans-serif; letter-spacing:.14em; text-transform:uppercase; color:#333; margin:8pt 0 5pt; border-bottom:1.5px solid #141414; padding-bottom:3pt; }
  .cols2 { display:grid; grid-template-columns:1fr 1fr; gap:8pt 10mm; align-items:start; }
  .divs { display:grid; grid-template-columns:1fr; gap:4.5pt; }
  .dpill .dt { font:600 8.7pt/1.2 Georgia,serif; margin-bottom:2pt; }
  .dbar { display:flex; height:13px; border-radius:7px; overflow:hidden; font:700 7.5pt/13px -apple-system,sans-serif; color:#fff; }
  .dbar .ay { background:#2b7a44; text-align:left; padding-left:5px; } .dbar .no { background:#b23b3b; text-align:right; padding-right:5px; }
  .dr { font:7.4pt/1 -apple-system,sans-serif; color:#666; margin-top:2pt; } .dr b { color:#2b7a44; } .dpill.no .dr b { color:#b23b3b; }
  .drows { display:flex; flex-direction:column; gap:4.2pt; }
  .drow { display:grid; grid-template-columns:1fr 20mm max-content; align-items:center; gap:8px; font:8.6pt/1.2 -apple-system,sans-serif; }
  .rt { min-width:0; color:#333; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .rbar { display:flex; height:9px; border-radius:5px; overflow:hidden; background:#eee; } .rbar i { display:block; height:9px; } .rbar .ay { background:#2b7a44; } .rbar .no { background:#b23b3b; }
  .rtl { font-weight:700; font-variant-numeric:tabular-nums; text-align:right; white-space:nowrap; color:#333; } .rtl .dash { color:#bbb; font-weight:400; padding:0 1px; }
  .drow.more { display:block; font-style:italic; color:#888; font-size:7.8pt; }
  .chart { display:grid; grid-template-columns:max-content 1fr max-content; gap:3.6px 7px; align-items:center; }
  .bl { font:8pt/1.2 -apple-system,sans-serif; color:#333; text-align:right; white-space:nowrap; }
  .bt { background:#eee; border-radius:3px; height:9px; } .bt i { display:block; height:9px; background:#6b2b6b; border-radius:3px; }
  .bv { font:8pt/1 -apple-system,sans-serif; color:#111; font-weight:700; text-align:right; font-variant-numeric:tabular-nums; }
  .tts { display:flex; flex-wrap:wrap; gap:4pt 14px; font:8.4pt/1.3 -apple-system,sans-serif; color:#444; }
  .tt b { color:#6b2b6b; font-variant-numeric:tabular-nums; }
  .feature { break-inside:avoid; background:#f6f3ee; border:.5px solid #d8d2c6; border-radius:4pt; padding:7pt 12pt; margin:7pt 0 0; }
  .feature .fk { font:700 8pt/1 -apple-system,sans-serif; letter-spacing:.06em; color:#6b2b6b; text-transform:uppercase; }
  .feature h4 { font:700 11pt/1.2 Georgia,serif; margin:2pt 0 3pt; } .feature p { margin:0; font-size:9.2pt; line-height:1.38; }
  .brief { column-count:2; column-gap:9mm; }
  .bitem { break-inside:avoid; font:8.6pt/1.32 Georgia,serif; color:#222; margin:0 0 3pt; }
  .bitem .ih { font:700 8.4pt/1.3 -apple-system,sans-serif; }
  .qa { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 9pt; align-items:start; }
  .qitem { break-inside:avoid; }
  .qh { font:700 8.6pt/1.25 -apple-system,sans-serif; margin-bottom:1.5pt; }
  .qh .qwho { font-weight:400; color:#666; }
  .qq { font-style:italic; font-size:8.5pt; line-height:1.35; color:#222; margin-bottom:2.5pt; }
  .qans { font-size:8.3pt; line-height:1.38; color:#333; }
  .qans b { font:700 7.4pt/1 -apple-system,sans-serif; letter-spacing:.05em; color:#6b2b6b; text-transform:uppercase; padding-right:2px; }
  .none,.recessnote { font-style:italic; color:#777; }
  .credit { margin-top:6pt; padding-top:4pt; border-top:.5px solid #eee; font:7.3pt/1.35 -apple-system,sans-serif; color:#8a8a8a; text-align:center; }
</style></head><body>
<div class="sheet" id="sheet">
  <span class="draft">DRAFT, PLAIN ENGLISH</span>
  <div class="kicker">This Week in Parliament, ${esc(label)}</div>
  <h1>${esc(headline)}</h1>
  <div class="stats"><b>${d.stats.divisions}</b> divisions &nbsp; <b>${d.stats.questions.toLocaleString()}</b> written questions &nbsp; <b>${d.stats.distinctAskers}</b> distinct askers</div>
  <p class="topstory">${esc(intro)}</p>
  ${brief(rw.brief)}
  ${body}
  <div class="credit">Draft overview for ${d.week}. Prose rewritten to the new plain-English style. The original article is unchanged and kept for reference.</div>
</div>
<script>(function(){var s=document.getElementById('sheet'),A4=297*96/25.4,f=10.5;s.style.fontSize=f+'pt';var g=0;while(s.scrollHeight>A4&&f>7&&g<50){f-=0.2;s.style.fontSize=f+'pt';g++;}var t=document.createElement('div');t.style.cssText='position:fixed;left:8px;bottom:8px;font:11px -apple-system,sans-serif;color:#fff;background:#333;padding:4px 8px;border-radius:4px;';t.textContent='${esc(label)} · ${d.highlights.votes.length} divisions · fitted '+f.toFixed(1)+'pt';t.className='so';document.body.appendChild(t);var st=document.createElement('style');st.textContent='@media print{.so{display:none!important}}';document.head.appendChild(st);})();</script>
</body></html>`
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
const rows = []
for (const file of files) {
  const d = JSON.parse(fs.readFileSync(DIR + '/' + file, 'utf8'))
  fs.writeFileSync(OUT + '/overview-' + d.week + '.html', renderOverview(d))
  rows.push({ label: d.windowLabel.replace(' – ', ' to '), divs: d.highlights.votes.length, mode: d.mode, file: 'overview-' + d.week + '.html' })
}
const index = `<!doctype html><html><head><meta charset="utf-8"><title>Format test</title>
<style>body{font:15px/1.5 -apple-system,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#222}h1{font-size:22px}a{color:#6b2b6b}li{margin:8px 0}.n{color:#888;font-size:13px}</style></head><body>
<h1>This Week in Parliament, one-page overview, format test</h1>
<p class="n">Each issue in the new one-A4 overview to test the layout, especially how the divisions section scales. Prose has been rewritten to the new plain-English style (no dashes, no colons, sparing commas, numbers spelled to ninety-nine). The original articles are unchanged and kept for reference.</p>
<ul>${rows.map((r) => `<li><a href="${r.file}">${r.label}</a>, <b>${r.divs}</b> division${r.divs === 1 ? '' : 's'} <span class="n">(${r.divs > 6 ? 'compact rows' : r.divs ? 'pills' : 'recess'})</span></li>`).join('')}</ul>
</body></html>`
fs.writeFileSync(OUT + '/index.html', index)
console.log('rendered', rows.length, 'overviews')
