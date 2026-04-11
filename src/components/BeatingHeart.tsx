"use client";

import { useEffect, useRef } from "react";

/**
 * Beating heart canvas animation.
 * Ported from CodeSlicing HeartShape.swift.
 * Draws a bezier heart that pulses with easeOut, matching the 0.42s iOS animation.
 */
export default function BeatingHeart({
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

    const BEAT_MS = 1400; // relaxed heartbeat
    let animId: number;

    function easeOut(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function drawHeart(
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      factor: number
    ) {
      // Grid-based control points (16 cols × 20 rows), matching the Swift Shape
      const gx = (col: number) => cx + ((col - 8) / 8) * size;
      const gy = (row: number) => cy + ((row - 10) / 10) * size;
      const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

      // Key points with animation factor
      const p1x = lerp(gx(0), gx(2), factor);
      const p1y = gy(6);
      const p2x = gx(8);
      const p2y = lerp(gy(4), gy(5), factor);
      const p3x = lerp(gx(16), gx(14), factor);
      const p3y = gy(6);
      const p4x = gx(8);
      const p4y = lerp(gy(20), gy(19), factor);

      ctx.beginPath();
      ctx.moveTo(p1x, p1y);

      // Top-left curve (to p2)
      ctx.bezierCurveTo(
        lerp(gx(0), gx(3), factor), lerp(gy(0), gy(2), factor),
        lerp(gx(6), gx(7), factor), lerp(gy(-2), gy(2), factor),
        p2x, p2y
      );

      // Top-right curve (to p3)
      ctx.bezierCurveTo(
        lerp(gx(10), gx(9), factor), lerp(gy(-2), gy(2), factor),
        lerp(gx(16), gx(13), factor), lerp(gy(0), gy(2), factor),
        p3x, p3y
      );

      // Right side down (to p4)
      ctx.bezierCurveTo(
        lerp(gx(16), gx(15), factor), gy(10),
        p4x, p4y,
        p4x, p4y
      );

      // Left side up (back to p1)
      ctx.bezierCurveTo(
        p4x, p4y,
        lerp(gx(0), gx(1), factor), gy(10),
        p1x, p1y
      );

      ctx.closePath();
    }

    function draw(now: number) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      // Pulsing factor: 0 → 1 → 0 over BEAT_MS
      const t = (now % BEAT_MS) / BEAT_MS;
      const raw = t < 0.5 ? t * 2 : 2 - t * 2;
      const factor = easeOut(raw);

      const size = Math.min(w, h) * 0.35;

      ctx!.shadowColor = "rgba(239, 68, 68, 0.5)";
      ctx!.shadowBlur = 14;
      ctx!.fillStyle = "rgba(239, 68, 68, 0.2)";

      drawHeart(ctx!, w / 2, h / 2, size, factor);
      ctx!.fill();

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
