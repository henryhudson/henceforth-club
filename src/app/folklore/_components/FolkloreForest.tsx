"use client";

import { useEffect, useRef } from "react";

/**
 * The forest behind the wordmark — layered spruce silhouettes under cloud and
 * haar, deepening as the reader scrolls.
 *
 * Inline SVG only (no image downloads on a speed-first funnel). One custom
 * property (--reveal, ~0.4 at rest → 1 on scroll) drives opacity/transform on
 * the compositor. prefers-reduced-motion: holds mid-reveal, no drift.
 *
 * Decoration only: aria-hidden, pointer-events-none.
 */

/** Deterministic 0..1 from a number — same tree always leans the same way. */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Tree plots: [x centre, height]. Optional 3rd flag: 1 = snag (bare upper). */
type Plot = readonly [number, number] | readonly [number, number, 1];

const FAR_TREES: readonly Plot[] = [
  [6, 52], [32, 70], [56, 48], [82, 78], [110, 58], [136, 86], [164, 50],
  [190, 74], [218, 60], [244, 90], [272, 54], [298, 80], [328, 66], [354, 94],
  [382, 56], [408, 76], [438, 62], [464, 88], [494, 52], [520, 82], [550, 64],
  [576, 92], [606, 54], [632, 78], [662, 60], [688, 86], [718, 58], [744, 96],
  [774, 50], [800, 74], [830, 62], [856, 84], [886, 56], [912, 80], [942, 66],
  [968, 90], [998, 52], [1024, 76], [1054, 60], [1080, 88], [1110, 54],
  [1136, 72], [1166, 64], [1192, 82],
];
const BACK_TREES: readonly Plot[] = [
  [18, 100], [58, 122], [102, 88], [148, 136], [196, 104], [242, 144], [294, 96],
  [340, 130], [390, 112], [438, 152], [490, 98], [536, 138], [588, 116], [636, 156],
  [688, 92], [734, 128], [786, 108], [834, 146], [886, 100], [934, 134], [986, 114],
  [1034, 148], [1086, 96], [1134, 126], [1180, 110],
];
const MID_TREES: readonly Plot[] = [
  [40, 158], [110, 186], [185, 148], [262, 204], [340, 168], [418, 216], [500, 154],
  [575, 198], [655, 176], [732, 224], [812, 162], [890, 202], [970, 180], [1048, 210],
  [1125, 170], [1190, 194], [48, 140, 1], [700, 150, 1],
];
const NEAR_TREES: readonly Plot[] = [
  [55, 248], [175, 292], [310, 230], [450, 310], [595, 256], [740, 298],
  [885, 240], [1030, 284], [1165, 262], [400, 200, 1],
];

/**
 * One spruce: six asymmetric tiers + trunk. Snags drop upper tiers so the
 * stand isn't a factory of identical Christmas trees.
 */
function spruce(x: number, h: number, baseY: number, snag = false): string {
  const lean = (hash01(x * 1.7 + h) - 0.5) * h * 0.07;
  const apexX = x + lean;
  const trunkHalf = Math.max(1.5, h * 0.026);
  const trunkTop = baseY - h * (snag ? 0.55 : 0.09);

  // [fromTop, halfWidthFac, span]
  const full: ReadonlyArray<readonly [number, number, number]> = [
    [1.0, 0.12, 0.18],
    [0.86, 0.17, 0.17],
    [0.72, 0.23, 0.17],
    [0.56, 0.29, 0.18],
    [0.4, 0.35, 0.17],
    [0.24, 0.41, 0.16],
  ];
  const layout = snag ? full.slice(3) : full;

  const tiers: string[] = [];
  for (let i = 0; i < layout.length; i++) {
    const [fromTop, halfFac, span] = layout[i];
    const topY = baseY - h * fromTop;
    const botY = Math.min(baseY - 2, topY + h * span);
    const half = h * halfFac;
    const bias = (hash01(x + i * 17.3) - 0.5) * half * 0.32;
    const left = apexX - half + bias - lean * (1 - fromTop) * 0.35;
    const right = apexX + half + bias - lean * (1 - fromTop) * 0.35;
    const midL = left + (apexX - left) * 0.32;
    const midR = right - (right - apexX) * 0.32;
    const dropL = botY + h * 0.018 * (0.4 + hash01(x + i * 3.1));
    const dropR = botY + h * 0.018 * (0.4 + hash01(x + i * 5.7));
    const peakX = apexX + (hash01(x * 0.3 + i) - 0.5) * half * 0.14;
    // Side spur — occasional branch jut for irregular silhouette
    const spur =
      hash01(x * 2.1 + i * 9) > 0.62
        ? ` L${(left - half * 0.18).toFixed(1)} ${(botY - h * 0.04).toFixed(1)}`
        : "";
    tiers.push(
      `M${peakX.toFixed(1)} ${topY.toFixed(1)} ` +
        `L${left.toFixed(1)} ${botY.toFixed(1)}${spur} ` +
        `L${midL.toFixed(1)} ${dropL.toFixed(1)} ` +
        `L${apexX.toFixed(1)} ${(botY - h * 0.012).toFixed(1)} ` +
        `L${midR.toFixed(1)} ${dropR.toFixed(1)} ` +
        `L${right.toFixed(1)} ${botY.toFixed(1)} Z`,
    );
  }

  // Snag: thin upper stem above the remaining foliage
  const snagPole = snag
    ? `M${(apexX - 1.2).toFixed(1)} ${(baseY - h).toFixed(1)} ` +
      `L${(apexX + 1.2).toFixed(1)} ${(baseY - h).toFixed(1)} ` +
      `L${(x + trunkHalf * 0.6).toFixed(1)} ${trunkTop.toFixed(1)} ` +
      `L${(x - trunkHalf * 0.6).toFixed(1)} ${trunkTop.toFixed(1)} Z`
    : "";

  const trunk =
    `M${(x - trunkHalf).toFixed(1)} ${trunkTop.toFixed(1)} ` +
    `L${(x + trunkHalf).toFixed(1)} ${trunkTop.toFixed(1)} ` +
    `L${(x + trunkHalf * 1.2).toFixed(1)} ${baseY.toFixed(1)} ` +
    `L${(x - trunkHalf * 1.2).toFixed(1)} ${baseY.toFixed(1)} Z`;

  return snagPole + " " + tiers.join(" ") + " " + trunk;
}

function groundBand(baseY: number, bottom: number): string {
  const pts: string[] = [`M0 ${baseY.toFixed(1)}`];
  for (let i = 0; i <= 16; i++) {
    const px = (1200 / 16) * i;
    const wave = Math.sin(i * 0.75 + baseY * 0.02) * 5 + Math.sin(i * 1.9) * 2.5;
    pts.push(`L${px.toFixed(1)} ${(baseY + wave).toFixed(1)}`);
  }
  pts.push(`L1200 ${bottom} L0 ${bottom} Z`);
  return pts.join(" ");
}

function treeline(trees: readonly Plot[], baseY: number, bottom = 360): string {
  const body = trees
    .map((plot) => {
      const x = plot[0];
      const h = plot[1];
      const snag = plot.length === 3;
      return spruce(x, h, baseY, snag);
    })
    .join(" ");
  return body + " " + groundBand(baseY, bottom);
}

const STARS: ReadonlyArray<readonly [number, number, number]> = [
  [70, 22, 0.9], [145, 40, 0.65], [230, 16, 0.85], [320, 34, 0.55], [410, 14, 1.0],
  [505, 30, 0.7], [595, 18, 0.55], [690, 38, 0.8], [785, 15, 0.6], [880, 32, 0.9],
  [975, 20, 0.55], [1070, 36, 0.7], [185, 52, 0.5], [460, 48, 0.5], [930, 50, 0.55],
  [50, 55, 0.45], [1180, 28, 0.6],
];

/** At rest the forest is already present — scroll only deepens it. */
const REVEAL_AT_REST = 0.42;
const REVEAL_SCROLL_PX = 420;

export default function FolkloreForest() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--reveal", "0.75");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const t = Math.min(1, Math.max(0, window.scrollY / REVEAL_SCROLL_PX));
      // Ease from rest floor → full
      const reveal = REVEAL_AT_REST + (1 - REVEAL_AT_REST) * t;
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
    <div
      ref={ref}
      aria-hidden
      className="folklore-forest pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* True black — room identity. Ember only at the horizon. */}
      <div className="forest-sky absolute inset-0" />
      <div className="forest-glow absolute inset-x-0 bottom-0 h-2/3" />

      <svg
        className="forest-stars absolute inset-0 h-full w-full"
        viewBox="0 0 1200 360"
        preserveAspectRatio="xMidYMid slice"
      >
        {STARS.map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} className="forest-star" />
        ))}
      </svg>

      <svg
        className="absolute inset-x-0 bottom-0 h-full w-full"
        viewBox="0 0 1200 360"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="forest-mist-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="50%" stopColor="#1a1a20" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        <path d={treeline(FAR_TREES, 298, 360)} className="treeline treeline-far" />
        <path d={treeline(BACK_TREES, 316, 360)} className="treeline treeline-back" />
        <rect className="forest-haar" x="0" y="190" width="1200" height="170" fill="url(#forest-mist-grad)" />
        <path d={treeline(MID_TREES, 330, 360)} className="treeline treeline-mid" />
        <path d={treeline(NEAR_TREES, 348, 360)} className="treeline treeline-near" />
      </svg>

      <div className="forest-fog absolute inset-x-0 bottom-0 h-2/5" />

      <svg
        className="clouds absolute inset-0 h-full w-full"
        viewBox="0 0 1200 360"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="cloud-soften" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
        </defs>
        <g filter="url(#cloud-soften)">
          <g className="cloud-drift-slow">
            <ellipse cx="180" cy="88" rx="360" ry="70" />
            <ellipse cx="500" cy="130" rx="300" ry="56" />
            <ellipse cx="940" cy="175" rx="400" ry="78" />
          </g>
          <g className="cloud-drift-fast">
            <ellipse cx="400" cy="58" rx="320" ry="48" />
            <ellipse cx="760" cy="100" rx="270" ry="46" />
            <ellipse cx="1120" cy="145" rx="250" ry="52" />
            <ellipse cx="40" cy="200" rx="310" ry="58" />
            <ellipse cx="620" cy="215" rx="340" ry="48" />
          </g>
        </g>
      </svg>
    </div>
  );
}
