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

/** Tree plots for one treeline strip — (x centre, height) pairs on a
 * 1200-wide stage, hand-tuned and deterministic: a seeded look that never
 * shifts between builds. Back rows are dense and short, near rows sparse
 * and tall, and the x positions carry jitter so nothing reads as a comb. */
const BACK_TREES: ReadonlyArray<readonly [number, number]> = [
  [18, 74], [76, 96], [128, 66], [180, 108], [242, 84], [298, 118], [352, 72],
  [408, 102], [470, 88], [524, 124], [578, 78], [634, 110], [692, 92], [748, 128],
  [806, 70], [858, 100], [914, 82], [968, 116], [1026, 76], [1082, 106], [1136, 90], [1188, 98],
];
const MID_TREES: ReadonlyArray<readonly [number, number]> = [
  [42, 128], [124, 156], [214, 118], [296, 172], [388, 136], [472, 184], [556, 126],
  [648, 164], [738, 144], [824, 190], [912, 132], [1000, 170], [1090, 150], [1172, 178],
];
const NEAR_TREES: ReadonlyArray<readonly [number, number]> = [
  [60, 190], [204, 236], [352, 176], [500, 252], [652, 200], [800, 244], [948, 186], [1096, 230],
];

/** One spruce as three stacked, widening branch tiers over a stub of trunk —
 * the layered silhouette a single triangle never manages. Returns closed
 * subpaths for one <path d>. */
function spruce(x: number, h: number, baseY: number): string {
  const tier = (apexY: number, baseHalf: number, tierBaseY: number) =>
    `M${x.toFixed(1)} ${apexY.toFixed(1)} L${(x - baseHalf).toFixed(1)} ${tierBaseY.toFixed(1)} L${(x + baseHalf).toFixed(1)} ${tierBaseY.toFixed(1)} Z`;
  const trunkHalf = Math.max(1.4, h * 0.022);
  return [
    tier(baseY - h, h * 0.17, baseY - h * 0.52),
    tier(baseY - h * 0.68, h * 0.25, baseY - h * 0.26),
    tier(baseY - h * 0.4, h * 0.33, baseY - h * 0.02),
    `M${(x - trunkHalf).toFixed(1)} ${(baseY - h * 0.08).toFixed(1)} L${(x + trunkHalf).toFixed(1)} ${(baseY - h * 0.08).toFixed(1)} L${(x + trunkHalf).toFixed(1)} ${baseY.toFixed(1)} L${(x - trunkHalf).toFixed(1)} ${baseY.toFixed(1)} Z`,
  ].join(" ");
}

/** A whole treeline: every spruce's subpaths plus a low ground band so the
 * trunks stand on something rather than floating. */
function treeline(trees: ReadonlyArray<readonly [number, number]>, baseY: number): string {
  const ground = `M0 ${(baseY - 3).toFixed(1)} L1200 ${(baseY - 3).toFixed(1)} L1200 340 L0 340 Z`;
  return trees.map(([x, h]) => spruce(x, h, baseY)).join(" ") + " " + ground;
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
        <path d={treeline(BACK_TREES, 316)} className="treeline treeline-back" />
        <path d={treeline(MID_TREES, 328)} className="treeline treeline-mid" />
        <path d={treeline(NEAR_TREES, 340)} className="treeline treeline-near" />
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
