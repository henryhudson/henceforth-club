"use client";

import { useEffect, useRef } from "react";

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

    function draw(now: number) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
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

      ctx!.strokeStyle = "rgba(94, 234, 212, 0.3)";
      ctx!.lineWidth = 1.5;
      ctx!.shadowColor = "rgba(94, 234, 212, 0.6)";
      ctx!.shadowBlur = 14;

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

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}
