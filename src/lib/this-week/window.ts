import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { subDays, format } from 'date-fns'

const TZ = 'Europe/London'

export interface Window {
  startISO: string
  endISO: string
  label: string
}

/** Last Wed 00:00 → this Wed 00:00 (London). `endISO` is the most recent Wednesday. */
export function sinceLastWednesday(now: Date): Window {
  const local = toZonedTime(now, TZ)
  const dow = Number(formatInTimeZone(now, TZ, 'i')) // 1=Mon..7=Sun
  const daysSinceWed = (dow - 3 + 7) % 7             // 0 if Wed
  const end = subDays(local, daysSinceWed)
  const start = subDays(end, 7)
  const endISO = format(end, 'yyyy-MM-dd')
  const startISO = format(start, 'yyyy-MM-dd')
  return { startISO, endISO, label: humanRange(startISO, endISO) }
}

function humanRange(a: string, b: string): string {
  const fmt = (s: string) => formatInTimeZone(new Date(s + 'T12:00:00Z'), TZ, 'd MMM')
  const year = b.slice(0, 4)
  return `${fmt(a)} – ${fmt(b)} ${year}`
}
