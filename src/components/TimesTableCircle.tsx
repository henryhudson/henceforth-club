"use client";

import { useEffect, useRef } from "react";

/**
 * Times-table circle canvas animation.
 * Ported from the SwiftUI TimesTableCircleShape used in Henceforth's loading screens.
 *
 * Connects odd-numbered points on a circle to their multiplied destinations,
 * producing cardioid / nephroid patterns that morph continuously.
 *
 * Pass `userMultiplier` to override the random cycling (e.g. from the terminal).
 * When cleared, it resumes random cycling.
 */
export default function TimesTableCircle({
  className = "",
  userMultiplier,
}: {
  className?: string;
  userMultiplier?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const userMultiplierRef = useRef(userMultiplier);

  // Keep the ref in sync with the prop so the animation loop's
  // long-lived closure always reads the latest value. Writing to a
  // ref must happen in an effect, not during render.
  useEffect(() => {
    userMultiplierRef.current = userMultiplier;
  }, [userMultiplier]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match the Swift Mandelbrot shape: 200 segments around the circle,
    // depth 6 nested multiplier hops per starting point. The marketing
    // cardioid GIF is rendered with these exact constants — using
    // anything lower drops resolution and visually loses lines.
    const SEGMENTS = 200;
    const DEPTH = 6;
    const OFFSET = -Math.PI / 2; // start at 12 o'clock

    // Weighted toward cardioid (2), with nephroid (3) and higher patterns
    const multipliers = [2, 2, 2, 2, 2, 3, 3, 3, 4, 5, 6, 7, 8, 9, 10];

    let currentMultiplier = 2;
    let targetMultiplier = 2;
    let animationStart = 0;
    const TRANSITION_MS = 3000;
    let lastSwitch = performance.now();
    let lastUserMultiplier: number | undefined;
    let animId: number;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;

    // Respect prefers-reduced-motion — paint one static cardioid and
    // skip the RAF loop if the user's OS asks for less motion.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function pickTarget() {
      targetMultiplier =
        multipliers[Math.floor(Math.random() * multipliers.length)];
      animationStart = performance.now();
    }

    // Spring-like ease (approximation of SwiftUI .spring(duration: 3))
    function ease(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function draw(now: number) {
      const um = userMultiplierRef.current;

      // If user set a multiplier, animate to it
      if (um !== undefined && um !== lastUserMultiplier) {
        currentMultiplier = targetMultiplier;
        targetMultiplier = um;
        animationStart = now;
        lastSwitch = now;
        lastUserMultiplier = um;
      } else if (um === undefined) {
        // Resume random cycling
        if (lastUserMultiplier !== undefined) {
          currentMultiplier = targetMultiplier;
          pickTarget();
          lastSwitch = now;
          lastUserMultiplier = undefined;
        } else if (now - lastSwitch >= TRANSITION_MS) {
          currentMultiplier = targetMultiplier;
          pickTarget();
          lastSwitch = now;
        }
      }

      // Interpolate multiplier
      const elapsed = now - animationStart;
      const t = Math.min(elapsed / TRANSITION_MS, 1);
      const multiplier =
        currentMultiplier +
        (targetMultiplier - currentMultiplier) * ease(t);

      // Handle high-DPI — only resize when dimensions change.
      // Setting canvas.width/height is destructive (resets the GPU
      // buffer and context state) so doing it every frame is the
      // single biggest source of jank for canvas RAF loops.
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w !== lastW || h !== lastH || dpr !== lastDpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        lastW = w;
        lastH = h;
        lastDpr = dpr;
      }

      ctx!.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;

      // Additive blending so the halo + core passes combine into a
      // proper neon-tube look instead of overwriting each other.
      ctx!.globalCompositeOperation = "lighter";

      ctx!.beginPath();
      for (let x = 1; x <= SEGMENTS; x += 2) {
        const startAngle =
          OFFSET + (2 * Math.PI * x) / SEGMENTS;
        ctx!.moveTo(
          cx + radius * Math.cos(startAngle),
          cy + radius * Math.sin(startAngle)
        );

        for (let i = 1; i <= DEPTH; i++) {
          const power = Math.pow(multiplier, i);
          // Wrap mod SEGMENTS, matching SwiftUI's polar layout guide
          // behaviour. Using `% (SEGMENTS + 1)` (the previous bug)
          // shifted boundary indices by one, occasionally collapsing
          // two distinct lines into the same endpoint and visually
          // losing a unique line from the cardioid envelope.
          const target = Math.round(x * power) % SEGMENTS;
          const endAngle =
            OFFSET + (2 * Math.PI * target) / SEGMENTS;
          ctx!.lineTo(
            cx + radius * Math.cos(endAngle),
            cy + radius * Math.sin(endAngle)
          );
        }
      }

      // Pass 1 — soft warm halo. shadowBlur is the most expensive
      // op in canvas2d; keep it small enough to render a 600-segment
      // path comfortably at 60fps.
      ctx!.strokeStyle = "rgba(251, 191, 36, 0.12)";
      ctx!.lineWidth = 2;
      ctx!.shadowColor = "rgba(251, 191, 36, 0.55)";
      ctx!.shadowBlur = 6;
      ctx!.stroke();

      // Pass 2 — thin bright core (path is preserved between strokes)
      ctx!.strokeStyle = "rgba(255, 224, 150, 0.45)";
      ctx!.lineWidth = 0.6;
      ctx!.shadowBlur = 0;
      ctx!.stroke();

      ctx!.globalCompositeOperation = "source-over";
      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    }

    pickTarget();
    if (prefersReducedMotion) {
      // Freeze at the default cardioid pattern
      currentMultiplier = 2;
      draw(performance.now());
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
