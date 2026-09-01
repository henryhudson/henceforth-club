'use client'
import { useLayoutEffect, useRef } from 'react'
import { fitTypeSize, START_PT, FLOOR_PT, CEIL_PT } from '@/lib/print/fit'
import s from './overview.module.css'

const A4_PX = 297 * 96 / 25.4

function refitPack(el: HTMLElement) {
  el.querySelector('[data-pack-root]')?.dispatchEvent(new Event('newspaper-fit'))
}

export default function A4Sheet({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const pack = el.querySelector('[data-pack-root]')
    if (pack instanceof HTMLElement) {
      // Fill the remaining slot, not the auto-height sheet: growing against
      // the whole page left a slack band under the squares because the pack
      // is flex-grown empty space.
      el.setAttribute('data-fitting', '')
      const pt = fitTypeSize((size) => {
        el.style.fontSize = size + 'pt'
        refitPack(el)
        return Number(pack.dataset.packMakespan) || 0
      }, () => pack.clientHeight)
      el.style.fontSize = pt + 'pt'
      el.removeAttribute('data-fitting')
      refitPack(el)
      return
    }
    const target = Math.floor(A4_PX)
    const apply = (pt: number) => {
      el.style.fontSize = pt + 'pt'
    }
    const prevMinHeight = el.style.minHeight
    const prevHeight = el.style.height
    const prevOverflow = el.style.overflow
    el.style.minHeight = '0px'
    el.style.height = 'auto'
    el.style.overflow = 'visible'
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
    el.style.minHeight = prevMinHeight
    el.style.height = prevHeight
    el.style.overflow = prevOverflow
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
