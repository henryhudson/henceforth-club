// The pure half of render-draft.mjs: the arguments, the publish refusal and
// the sheet's address, kept apart from Chrome and the dev server so the
// draft-must-not-publish rule can be asserted by the suite.
import { join } from 'node:path'

export function parseArgs(argv) {
  const out = { week: null, base: 'http://localhost:3000', out: null, publish: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') out.base = argv[++i]
    else if (a === '--out') out.out = argv[++i]
    else if (a === '--publish') out.publish = true
    else if (!out.week) out.week = a
  }
  return out
}

/** Why --publish must refuse this week, or null when it may proceed. Only a
 *  published week may be committed alongside its JSON; a review render is
 *  never refused, because a draft is exactly what the preview is for. */
export function publishRefusal(week, digest, publish) {
  if (!publish || digest?.status === 'published') return null
  return `content/this-week/${week}.json is still a draft — flip status to "published" before --publish`
}

/** Where the sheet lands, given the script's own directory: --out wins;
 *  --publish writes public/this-week/<week>.pdf, the address the Hansard app
 *  fetches; a review render stays local under scripts/this-week/preview. */
export function sheetPath({ week, out, publish }, here) {
  if (out) return out
  return publish
    ? join(here, '..', '..', 'public', 'this-week', `${week}.pdf`)
    : join(here, 'preview', `${week}.pdf`)
}
