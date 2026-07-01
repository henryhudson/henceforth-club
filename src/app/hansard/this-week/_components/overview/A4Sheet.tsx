'use client'
import { useEffect, useRef } from 'react'
import s from './overview.module.css'

const A4_PX = 297 * 96 / 25.4
const START_PT = 10.5
const FLOOR_PT = 6.6

export default function A4Sheet({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let pt = START_PT
    el.style.fontSize = pt + 'pt'
    for (let guard = 0; el.scrollHeight > Math.ceil(A4_PX) && pt > FLOOR_PT && guard < 50; guard++) {
      pt -= 0.2
      el.style.fontSize = pt + 'pt'
    }
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
