"use client";

import { useEffect, useRef } from "react";

/**
 * The forest behind the wordmark — three pine treelines under a bank of
 * clouds that part as the reader scrolls down, revealing the forest.
 *
 * Everything is inline SVG in the room's palette (blacks lifted barely off
 * the surface, one low orange glow at the horizon): no image downloads on a
 * funnel whose whole plan is speed. The reveal is a single CSS custom
 * property (--reveal, 0 at the top of the page → 1 a few hundred pixels
 * down) written from one passive scroll listener; every layer consumes it
 * with plain opacity/transform calc(), so the animation runs entirely on
 * the compositor. Cloud drift is a CSS keyframe. Under
 * prefers-reduced-motion the drift stops and the composition holds at
 * mid-reveal — a still forest through thin cloud, nothing moving.
 *
 * Decoration only: aria-hidden, pointer-events-none, behind the hero text.
 */

/** Peak heights for one treeline strip, hand-tuned — deterministic, no
 * randomness (a seeded look that never shifts between builds). Values are
 * pine heights in viewBox units on a 1200-wide strip. */
const BACK_PEAKS = [46, 62, 40, 70, 52, 78, 44, 66, 50, 74, 42, 68, 56, 80, 48, 64, 38, 72, 54, 76, 46, 60, 50, 70];
const MID_PEAKS = [64, 88, 52, 96, 70, 104, 58, 92, 66, 100, 54, 90, 74, 108, 62, 86, 50, 98, 72, 102, 60, 84, 68, 94];
const NEAR_PEAKS = [88, 118, 72, 128, 96, 138, 80, 124, 90, 134, 76, 120, 100, 142, 86, 116, 70, 130, 98, 136, 82, 112, 92, 126];

/** A treeline path: evenly spaced pines of the given heights, each a
 * triangle with a small trunk notch, closed along the strip's bottom. */
function treeline(peaks: readonly number[], height: number): string {
  const step = 1200 / peaks.length;
  const parts = [`M0 ${height}`];
  peaks.forEach((peak, i) => {
    const left = i * step;
    const mid = left + step / 2;
    const spread = step * 0.46;
    parts.push(
      `L${(mid - spread).toFixed(1)} ${height}`,
      `L${mid.toFixed(1)} ${(height - peak).toFixed(1)}`,
      `L${(mid + spread).toFixed(1)} ${height}`,
    );
  });
  parts.push(`L1200 ${height} Z`);
  return parts.join(" ");
}

export default function FolkloreForest() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--reveal", "0.6");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const reveal = Math.min(1, Math.max(0, window.scrollY / 340));
      el.style.setProperty("--reveal", reveal.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="folklore-forest pointer-events-none absolute inset-0 overflow-hidden">
      {/* A low warm glow on the horizon the treelines stand against */}
      <div className="forest-glow absolute inset-x-0 bottom-0 h-2/3" />
      <svg
        className="absolute inset-x-0 bottom-0 h-full w-full"
        viewBox="0 0 1200 340"
        preserveAspectRatio="xMidYMax slice"
      >
        <path d={treeline(BACK_PEAKS, 340)} className="treeline treeline-back" />
        <path d={treeline(MID_PEAKS, 340)} className="treeline treeline-mid" />
        <path d={treeline(NEAR_PEAKS, 340)} className="treeline treeline-near" />
      </svg>
      {/* The cloud bank: blurred drifting ellipses that thin as --reveal grows */}
      <svg className="clouds absolute inset-0 h-full w-full" viewBox="0 0 1200 340" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="cloud-soften" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>
        <g filter="url(#cloud-soften)">
          <g className="cloud-drift-slow">
            <ellipse cx="240" cy="120" rx="300" ry="64" />
            <ellipse cx="880" cy="200" rx="360" ry="76" />
          </g>
          <g className="cloud-drift-fast">
            <ellipse cx="560" cy="90" rx="320" ry="58" />
            <ellipse cx="1080" cy="150" rx="260" ry="52" />
            <ellipse cx="80" cy="230" rx="280" ry="60" />
          </g>
        </g>
      </svg>
    </div>
  );
}
