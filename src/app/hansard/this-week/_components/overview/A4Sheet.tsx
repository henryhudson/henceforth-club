'use client'
import { useLayoutEffect, useRef } from 'react'
import s from './overview.module.css'

// The newspaper measure (design spec 2026-08-19): 7pt body on the sheet root,
// every content size in em so this loop scales the whole hierarchy together.
// The floor is the trade's 600-dots-per-inch legibility limit; the ceiling
// keeps a light recess week from swelling back to book size.
const A4_PX = 297 * 96 / 25.4
const START_PT = 7
const FLOOR_PT = 6
const CEIL_PT = 8.5

function refitPack(el: HTMLElement) {
  el.querySelector('[data-pack-root]')?.dispatchEvent(new Event('newspaper-fit'))
}

export default function A4Sheet({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const target = Math.floor(A4_PX)
    // Measure the natural content height (drop the 297mm floor so a light week
    // can be detected as under-filling), then scale the type to *fill* the
    // page — shrinking a heavy week, growing a light one — the way a broadsheet
    // sets a page to the sheet rather than leaving a slack column.
    // PackLayout assigns squares at the current size, so each step re-packs
    // before we read the height; otherwise the type loop would be measuring
    // yesterday's columns.
    const apply = (pt: number) => {
      el.style.fontSize = pt + 'pt'
      refitPack(el)
    }
    const prevMinHeight = el.style.minHeight
    const prevHeight = el.style.height
    const prevOverflow = el.style.overflow
    el.style.minHeight = '0px'
    el.style.height = 'auto'
    el.style.overflow = 'visible'
    el.setAttribute('data-fitting', '')
    let pt = START_PT
    apply(pt)
    if (el.scrollHeight > target) {
      for (let g = 0; el.scrollHeight > target && pt > FLOOR_PT && g < 60; g++) {
        pt -= 0.2
        apply(pt)
      }
    } else {
      for (let g = 0; el.scrollHeight <= target && pt < CEIL_PT && g < 60; g++) {
        pt += 0.2
        apply(pt)
      }
      if (el.scrollHeight > target) {
        pt -= 0.2
        apply(pt)
      }
    }
    el.removeAttribute('data-fitting')
    el.style.minHeight = prevMinHeight
    el.style.height = prevHeight
    el.style.overflow = prevOverflow
    refitPack(el)
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
