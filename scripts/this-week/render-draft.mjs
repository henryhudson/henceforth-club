// Render a "This Week in Parliament" DRAFT to a one-page A4 review PDF, then open
// it. Draft issues 404 on the public route by design, so this points at the
// dev-only preview route (src/app/hansard/this-week/[week]/preview) served by a
// LOCAL dev server — never the live site.
//
// Usage (from henceforth-club, with `npm run dev` already running):
//   node scripts/this-week/render-draft.mjs 2026-07-15
//   node scripts/this-week/render-draft.mjs 2026-07-15 --base http://localhost:3000
//   node scripts/this-week/render-draft.mjs 2026-07-15 --out /tmp/hansard.pdf
//   node scripts/this-week/render-draft.mjs 2026-07-15 --publish
//
// --publish is the publishing step, not the review step: it writes the sheet to
// public/this-week/<week>.pdf (the address the Hansard iOS app fetches), skips
// the PNG and the viewer, and refuses a draft — only a published week may be
// committed alongside its JSON.
//
// Mirrors the puppeteer-core + local-Chrome pattern of scripts/board/render-pdf.mjs.
import puppeteer from 'puppeteer-core'
import { PDFDocument } from 'pdf-lib'
import { execSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, publishRefusal, sheetPath } from './render-draft-core.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const { week, base, out, publish } = parseArgs(process.argv.slice(2))
if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
  console.error('usage: node scripts/this-week/render-draft.mjs <YYYY-MM-DD> [--base URL] [--out PATH] [--publish]')
  process.exit(1)
}

// Confirm the draft exists on disk before spinning up Chrome.
const digestPath = join(HERE, '..', '..', 'content', 'this-week', `${week}.json`)
if (!existsSync(digestPath)) {
  console.error(`no digest at content/this-week/${week}.json — write the draft first (see scripts/this-week/PROMPT.md)`)
  process.exit(1)
}
const refusal = publishRefusal(week, JSON.parse(readFileSync(digestPath, 'utf8')), publish)
if (refusal) {
  console.error(refusal)
  process.exit(1)
}

const url = `${base.replace(/\/$/, '')}/hansard/this-week/${week}/preview`

// Preflight: a clear message beats a puppeteer timeout when the dev server is down.
try {
  const res = await fetch(url, { redirect: 'manual' })
  if (res.status >= 400) throw new Error(`preview route answered ${res.status}`)
} catch (err) {
  console.error(`cannot reach ${url}\n  Is the dev server running? Start it with: npm run dev\n  (${err.message})`)
  process.exit(1)
}

const browser = await puppeteer.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  // deviceScaleFactor 3 → a crisp ~2380×3370 PNG of the A4 sheet (fit is measured
  // in CSS px, so the scale factor doesn't affect layout).
  await page.setViewport({ width: 900, height: 1400, deviceScaleFactor: 3 })
  const resp = await page.goto(url, { waitUntil: 'networkidle0', timeout: 45_000 })
  if (!resp || !resp.ok()) throw new Error(`${url} answered ${resp ? resp.status() : 'nothing'} — not rendering`)
  // A4Sheet fits the type to the sheet in a useEffect after the web font loads;
  // wait for fonts and give the fit loop a beat before capturing.
  await page.evaluate(() => document.fonts.ready)
  await new Promise(r => setTimeout(r, 400))
  const overflow = await page.evaluate(() => Number(document.querySelector('[data-pack-root]')?.dataset.packOverflow ?? 0))

  // Zero margins to match A4Sheet's own `@page { margin: 0 }` — the sheet fits its
  // type to the FULL A4 height, so Chrome's default ~1cm margin (and the 12mm
  // globals.css @page rule) would push the last inch onto a second page.
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } })
  // The shareable image: a hi-res PNG of the sheet itself (the `.a4-print-root`
  // element, so no surrounding page chrome or the on-screen Print button).
  const sheet = publish ? null : await page.$('.a4-print-root')
  const png = sheet ? await sheet.screenshot({ type: 'png' }) : null
  await page.close()

  const pages = (await PDFDocument.load(pdf)).getPageCount()
  const clipped = overflow > 1
  if (clipped) {
    console.error(`OVERFLOW: the packed columns overflow the sheet by ${overflow}px at the floor type size — the page clips text; tighten the copy before publishing`)
    console.error('  not opening it: a clipped sheet is not a proof, and opening one is how a reader ends up reading the fault')
    process.exitCode = 2
  }
  if (pages > 1) {
    console.warn(`warning: ${pages} pages — a one-page edition overran; the draft still renders, but the print stylesheet may need tightening`)
  }

  const pdfPath = sheetPath({ week, out, publish }, HERE)
  const pngPath = pdfPath.replace(/\.pdf$/i, '.png')
  await mkdir(dirname(pdfPath), { recursive: true })
  await writeFile(pdfPath, pdf)
  if (png) await writeFile(pngPath, png)
  // Blocking open so the viewer launches before the process exits; best-effort so
  // a headless environment never fails the render (matches render-pdf.mjs). Open
  // the PNG — the artifact meant for sharing — falling back to the PDF.
  if (!publish && !clipped) {
    try { execSync(`open ${JSON.stringify(png ? pngPath : pdfPath)}`) } catch { /* open is best-effort */ }
  }
  const tail = publish ? ' — published sheet' : (png ? ` and ${pngPath} (${(png.length / 1024).toFixed(0)} KB image) — opened the image` : ' — opened for review')
  console.log(`wrote ${pdfPath} (${pages} page${pages === 1 ? '' : 's'})` + tail)
} finally {
  await browser.close()
}
