import fs from 'fs'
import path from 'path'
import type { DigestData, DigestSummary } from './types'
import { toSummary } from './calendar'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'this-week')

/** Every week slug (YYYY-MM-DD) with a digest file, drafts included, newest
 *  first. Callers that must not surface a draft want `listPublishedDigests`. */
export function listWeekSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  return fs
    .readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort()
    .reverse()
}

/** Load and parse a digest by week slug. Returns null on any failure. */
export function loadDigest(week: string): DigestData | null {
  const filePath = path.join(CONTENT_DIR, `${week}.json`)
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as DigestData
    return data
  } catch {
    return null
  }
}

/** Pure: keep only published digests, dropping drafts and load failures while
 *  preserving input order. Keeping this separate from the filesystem read lets
 *  the archive's "never link a draft (it would 404)" rule be asserted directly. */
export function selectPublished(digests: readonly (DigestData | null)[]): DigestData[] {
  return digests.filter((d): d is DigestData => d?.status === 'published')
}

/** All published digests, newest first — the archive index. */
export function listPublishedDigests(): DigestData[] {
  return selectPublished(listWeekSlugs().map(loadDigest))
}

/** All published issues as summaries, newest first. */
export function listPublishedSummaries(): DigestSummary[] {
  return listPublishedDigests().map(toSummary)
}
