'use client'
import { useEffect, useRef } from 'react'
import s from './overview.module.css'

// The newspaper measure (design spec 2026-08-19): 7pt body on the sheet root,
// every content size in em so this loop scales the whole hierarchy together.
// The floor is the trade's 600-dots-per-inch legibility limit; the ceiling
// keeps a light recess week from swelling back to book size.
const A4_PX = 297 * 96 / 25.4
const START_PT = 7
const FLOOR_PT = 6
const CEIL_PT = 8.5

export default function A4Sheet({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = Math.floor(A4_PX)
    // Measure the natural content height (drop the 297mm floor so a light week
    // can be detected as under-filling), then scale the type to *fill* the
    // page — shrinking a heavy week, growing a light one — the way a broadsheet
    // sets a page to the sheet rather than leaving a slack column.
    const prevMinHeight = el.style.minHeight
    el.style.minHeight = '0px'
    let pt = START_PT
    el.style.fontSize = pt + 'pt'
    if (el.scrollHeight > target) {
      for (let g = 0; el.scrollHeight > target && pt > FLOOR_PT && g < 60; g++) {
        pt -= 0.2
        el.style.fontSize = pt + 'pt'
      }
    } else {
      for (let g = 0; el.scrollHeight <= target && pt < CEIL_PT && g < 60; g++) {
        pt += 0.2
        el.style.fontSize = pt + 'pt'
      }
      if (el.scrollHeight > target) {
        pt -= 0.2
        el.style.fontSize = pt + 'pt'
      }
    }
    el.style.minHeight = prevMinHeight
  }, [])
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          .a4-print-root, .a4-print-root * { visibility: visible; }
          .a4-print-root { position: absolute; top: 0; left: 0; margin: 0; box-shadow: none; }
        }
      `}</style>
      <button className={s.printBtn} onClick={() => window.print()}>Print</button>
      <div className={`${s.sheet} a4-print-root`} ref={ref}>{children}</div>
    </>
  )
}
