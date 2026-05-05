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

    const SEGMENTS = 150;
    const DEPTH = 8;
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

      // Handle high-DPI
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

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
          const target = Math.round(x * power) % (SEGMENTS + 1);
          const endAngle =
            OFFSET + (2 * Math.PI * target) / SEGMENTS;
          ctx!.lineTo(
            cx + radius * Math.cos(endAngle),
            cy + radius * Math.sin(endAngle)
          );
        }
      }

      // Pass 1 — soft warm halo
      ctx!.strokeStyle = "rgba(251, 191, 36, 0.10)";
      ctx!.lineWidth = 2.5;
      ctx!.shadowColor = "rgba(251, 191, 36, 0.55)";
      ctx!.shadowBlur = 12;
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
