"use client";

import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

/**
 * Expanding circles animation.
 * Ported from CircleMath/CirclesThatGetBiggerView.swift.
 *
 * A hexagonal grid of circles that breathe from small to double size
 * and back, creating a flower-of-life pattern when they overlap.
 */

// Exact positions from the SwiftUI source (rotated 90°)
const POSITIONS: [number, number][] = [
  // center
  [0, 0],
  // layer 1
  [12, 20], [-12, -20], [24, 0], [-24, 0], [12, -20], [-12, 20],
  // layer 2
  [0, 40], [0, -40], [24, 40], [-24, 40], [24, -40], [-24, -40],
  [36, 20], [36, -20], [-36, 20], [-36, -20], [48, 0], [-48, 0],
  // layer 3
  [-72, 0], [72, 0], [12, 60], [12, -60], [-12, 60], [-12, -60],
  [36, 60], [36, -60], [-36, 60], [-36, -60],
  [60, 20], [60, -20], [-60, 20], [-60, -20],
  [48, 40], [48, -40], [-48, 40], [-48, -40],
  // layer 4
  [72, 40], [72, -40], [-72, 40], [-72, -40],
  [84, 20], [84, -20], [-84, 20], [-84, -20],
  [60, 60], [60, -60], [-60, 60], [-60, -60],
  [96, 0], [-96, 0],
  [0, 80], [24, 80], [48, 80], [-24, 80], [-48, 80],
  [0, -80], [24, -80], [48, -80], [-24, -80], [-48, -80],
];

export default function ExpandingCircles({
  className = "",
}: {
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const MIN_RADIUS = 11;
    const MAX_RADIUS = 24;
    const CYCLE_MS = 4600;
    const EXPAND_MS = 2000;
    const PAUSE_MS = 300;

    let animId: number;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;
    let onScreen = true;

    // Respect prefers-reduced-motion: paint one static frame and skip the
    // breathe loop for readers who have asked for less motion. The value
    // comes from the shared subscription rather than a one-time read here,
    // so a reader who turns the preference on while the page is open is
    // answered at once instead of at the next full remount. This was the
    // last of the seven call sites still reading it once.

    function draw(now: number) {
      // Every frame re-rasterises 62 separately shadow-blurred strokes,
      // which is the most expensive per-frame draw on the site. Off-screen
      // none of it is visible, so skip the drawing but keep the clock
      // turning — the breathe phase on return is then exactly the phase it
      // would have reached had the loop never stopped.
      if (!onScreen) {
        animId = requestAnimationFrame(draw);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      // Resizing the canvas resets all context state, so only do it
      // when dimensions actually change — otherwise we're resetting
      // the GPU buffer 60 times a second for no reason.
      if (w !== lastW || h !== lastH || dpr !== lastDpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        lastW = w;
        lastH = h;
        lastDpr = dpr;
      }
      ctx!.clearRect(0, 0, w, h);

      // Breathe cycle
      const t = (now % CYCLE_MS) / CYCLE_MS;
      let radius: number;

      const pauseFrac = PAUSE_MS / CYCLE_MS;
      const expandFrac = EXPAND_MS / CYCLE_MS;

      if (t < pauseFrac) {
        radius = MIN_RADIUS;
      } else if (t < pauseFrac + expandFrac) {
        const expandT = (t - pauseFrac) / expandFrac;
        radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * expandT;
      } else if (t < pauseFrac * 2 + expandFrac) {
        radius = MAX_RADIUS;
      } else {
        const contractT =
          (t - pauseFrac * 2 - expandFrac) / expandFrac;
        radius = MAX_RADIUS - (MAX_RADIUS - MIN_RADIUS) * contractT;
      }

      const cx = w / 2;
      const cy = h / 2;

      // Scale so the grid fits the canvas (96 is the max x offset)
      const scale = Math.min(w, h) / (96 * 2 + MAX_RADIUS * 2 + 20);

      // Additive blending: overlapping circles brighten at intersections,
      // turning the fully-expanded grid into a self-illuminating
      // flower-of-life / Twetch-logo pattern.
      ctx!.globalCompositeOperation = "lighter";

      // Stroke width is in design coords (matches SwiftUI's
      // `.stroke(lineWidth: 2)`), then scaled with the rest of the
      // vector design. Without the `* scale` factor the strokes stay
      // at 2 raw pixels regardless of canvas size, so as the canvas
      // grows the stroke's contribution to the visual outer radius
      // shrinks and the circles never quite touch.
      ctx!.lineWidth = 2 * scale;
      ctx!.strokeStyle = "rgba(94, 234, 212, 0.55)";
      ctx!.shadowColor = "rgba(94, 234, 212, 0.95)";
      ctx!.shadowBlur = 16;

      // The SwiftUI version is rotated 90°, so swap x/y
      for (const [px, py] of POSITIONS) {
        ctx!.beginPath();
        ctx!.arc(
          cx + py * scale,
          cy + px * scale,
          radius * scale,
          0,
          Math.PI * 2
        );
        ctx!.stroke();
      }

      // Restore default composite for the next frame's clearRect
      ctx!.globalCompositeOperation = "source-over";

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    }

    if (prefersReducedMotion) {
      // Half a cycle in is the max-radius plateau: the fully-expanded
      // flower-of-life this grid exists to draw.
      draw(CYCLE_MS * 0.5);
      return;
    }

    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    visibility.observe(canvas);

    animId = requestAnimationFrame(draw);
    return () => {
      visibility.disconnect();
      cancelAnimationFrame(animId);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}
