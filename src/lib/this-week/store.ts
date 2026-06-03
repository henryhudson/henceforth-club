import fs from 'fs'
import path from 'path'
import type { DigestData } from './types'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'this-week')

/** Returns all week slugs (YYYY-MM-DD) that have a published digest, newest first. */
export function listPublishedWeeks(): string[] {
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

/** Load the most recently published digest. Returns null if none exist. */
export function loadLatestPublishedDigest(): DigestData | null {
  const weeks = listPublishedWeeks()
  for (const week of weeks) {
    const digest = loadDigest(week)
    if (digest && digest.status === 'published') return digest
  }
  return null
}
