import type { MayorSeat } from '@/lib/this-week/types'
import { UK_SEATS } from '@/lib/uk-seats'
import s from './overview.module.css'

interface MayorsProps {
  title: string
  note?: string
  seats: MayorSeat[]
}

/** England's regional mayors as a map beside a roll, cabinet-style.
 *
 *  The country's outline is not drawn — it emerges from the same 650
 *  constituency dots the Hansard landing page animates, rendered faint and
 *  colourless so the only colour on the map is the fourteen mayoral seats.
 *  Labels live in a north-to-south roll beside the map rather than on it:
 *  fourteen labels around the Pennines would collide, and a reader matching
 *  dot to row by latitude is doing exactly what the graphic wants.
 */

// England-and-Wales window. Scotland and Northern Ireland fall outside it —
// no combined authority sits there, and including them would shrink the
// mayoral heartland to make room for dots that could never gain a colour.
const MIN_LON = -6.2
const MAX_LON = 1.9
const MIN_LAT = 49.9
const MAX_LAT = 55.7
// Equirectangular with a cos(53°) width correction so England keeps its
// familiar proportions instead of the smeared look of raw degrees.
const K = 100
const LON_SCALE = 0.6
const W = Math.round((MAX_LON - MIN_LON) * K * LON_SCALE)
const H = Math.round((MAX_LAT - MIN_LAT) * K)
const px = (lon: number) => (lon - MIN_LON) * K * LON_SCALE
const py = (lat: number) => (MAX_LAT - lat) * K

const partyColour = (party: string) =>
  party.includes('Labour') ? '#E4003B'
  : party.includes('Conservative') ? '#0087DC'
  : party.includes('Reform') ? '#12B6CF'
  : '#8b949e'

export default function Mayors({ title, note, seats }: MayorsProps) {
  if (!seats.length) return null
  const backdrop = UK_SEATS.filter(
    ([lon, lat]) => lon >= MIN_LON && lon <= MAX_LON && lat >= MIN_LAT && lat <= MAX_LAT,
  )
  const roll = [...seats].sort((a, b) => b.lat - a.lat)
  const tally = new Map<string, number>()
  for (const seat of seats) tally.set(seat.party, (tally.get(seat.party) ?? 0) + 1)
  const tallyLine = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([party, n]) => `${party} ${n}`)
    .join(' · ')

  return (
    <>
      <h3 className={s.sectionTitle}>{title}</h3>
      {note && <p className={s.cabNote}>{note}</p>}
      <div className={s.mayors}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={s.mayorsMap}
          role="img"
          aria-label={`${seats.length} regional mayoralties on a map of England, coloured by party`}
        >
          {backdrop.map(([lon, lat], i) => (
            <circle key={i} cx={px(lon)} cy={py(lat)} r={2.1} fill="#c9c4ba" />
          ))}
          {roll.map((m) => (
            <circle
              key={m.authority}
              cx={px(m.lon)}
              cy={py(m.lat)}
              r={11}
              fill={partyColour(m.party)}
              stroke="#fff"
              strokeWidth={2.5}
            />
          ))}
        </svg>
        <div className={s.mayorsRoll}>
          {roll.map((m) => (
            <div key={m.authority} className={s.mayorRow}>
              <span className={s.mayorDot} style={{ background: partyColour(m.party) }} />
              <span className={s.mayorAuthority}>{m.authority}</span>
              <span className={s.mayorName}>{m.name}</span>
            </div>
          ))}
          <p className={s.mayorTally}>{tallyLine}</p>
        </div>
      </div>
    </>
  )
}
