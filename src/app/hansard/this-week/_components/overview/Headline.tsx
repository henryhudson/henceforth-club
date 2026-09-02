'use client'
import { useLayoutEffect, useRef } from 'react'
import s from './overview.module.css'

/** The largest and smallest the headline may be set, as a multiple of the
 *  sheet's own type size. A subeditor sizes the head to the measure; this does
 *  the same, so a chosen headline is never broken across two lines when it
 *  could be set on one. */
const MAX_EM = 3.55
const MIN_EM = 1.9
const STEP = 0.05

/** Set the headline on one line, shrinking the type until it fits the measure.
 *  A headline too long even at the floor keeps the floor and wraps, because a
 *  page with an unreadable head is worse than a page with two lines. */
export default function Headline({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const oneLine = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
      return !Number.isFinite(lineHeight) || el.scrollHeight <= lineHeight * 1.35
    }
    let em = MAX_EM
    el.style.fontSize = `${em}em`
    el.style.whiteSpace = 'nowrap'
    const overflows = () => el.scrollWidth > el.clientWidth
    for (let guard = 0; overflows() && em > MIN_EM && guard < 60; guard++) {
      em = Math.round((em - STEP) * 100) / 100
      el.style.fontSize = `${em}em`
    }
    if (overflows()) {
      // Even at the floor it will not sit on one line: let it wrap rather than
      // set the head at a size the page cannot carry.
      el.style.whiteSpace = 'normal'
    }
    void oneLine
  }, [children])

  return (
    <h1 className={s.headline} ref={ref}>
      {children}
    </h1>
  )
}
