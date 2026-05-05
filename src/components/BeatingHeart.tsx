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

    // Match Swift's `easeOut(duration: 0.42).repeatForever(autoreverses: true)`.
    // 0.42s forward + 0.42s back = 840ms per full beat.
    const BEAT_MS = 840;
    let animId: number;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;

    // Respect prefers-reduced-motion — paint one static heart and
    // skip the pulse loop for users who've asked for less motion.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      // Only resize when dimensions actually change — assigning to
      // canvas.width is a destructive op (full GPU buffer reset and
      // context state wipe) so doing it 60×/sec was the main lag source.
      if (w !== lastW || h !== lastH || dpr !== lastDpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        lastW = w;
        lastH = h;
        lastDpr = dpr;
      }
      ctx!.clearRect(0, 0, w, h);

      // Full-amplitude pulse 0 → 1 → 0, matching the Swift Heart's
      // animatableData range. easeOut applied to each half of the
      // triangle wave separately (mirrors SwiftUI's autoreversing
      // easeOut — both directions feel "fast at start, slow at end",
      // giving the punchy pulse the Swift original has).
      const t = (now % BEAT_MS) / BEAT_MS;
      const half = t < 0.5 ? t * 2 : (1 - t) * 2;
      const factor = easeOut(half);

      const size = Math.min(w, h) * 0.35;

      // Build the path once; we'll fill+stroke it multiple times.
      drawHeart(ctx!, w / 2, h / 2, size, factor);

      // Additive composite so the bloom + outline passes layer
      // correctly into a neon-tube look.
      ctx!.globalCompositeOperation = "lighter";

      // Pass 1 — wide red bloom (fill with big shadow). The shadow
      // is rendered as a blurred copy of the path, so this paints a
      // soft halo around the heart silhouette.
      ctx!.shadowColor = "rgba(239, 68, 68, 0.95)";
      ctx!.shadowBlur = 24;
      ctx!.fillStyle = "rgba(239, 68, 68, 0.35)";
      ctx!.fill();

      // Pass 2 — bright neon outline with tighter glow.
      ctx!.shadowBlur = 8;
      ctx!.strokeStyle = "rgba(255, 130, 145, 0.9)";
      ctx!.lineWidth = 2;
      ctx!.stroke();

      ctx!.globalCompositeOperation = "source-over";

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    }

    if (prefersReducedMotion) {
      draw(BEAT_MS * 0.5); // paint mid-beat static frame and exit
      return;
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
