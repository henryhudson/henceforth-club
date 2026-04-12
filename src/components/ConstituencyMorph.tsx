"use client";

import { useEffect, useRef } from "react";

/**
 * 650 constituency dots that morph between a UK geographic map
 * and a pie chart grouped by party (largest to smallest).
 */

// Each seat: [longitude, latitude, partyColour]
type Seat = [number, number, string];

export default function ConstituencyMorph({
  seats,
  className = "",
}: {
  seats: Seat[];
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pre-compute map positions (normalised 0-1)
    const minLon = -8, maxLon = 2;
    const minLat = 49.8, maxLat = 60.2;
    const lonRange = maxLon - minLon;
    const latRange = maxLat - minLat;

    const mapPositions = seats.map(([lon, lat]) => ({
      x: (lon - minLon) / lonRange,
      y: (maxLat - lat) / latRange,
    }));

    // Pre-compute pie chart positions
    // Group by party colour, sorted largest to smallest
    const partyCounts = new Map<string, number>();
    for (const [, , colour] of seats) {
      partyCounts.set(colour, (partyCounts.get(colour) || 0) + 1);
    }
    const sortedParties = [...partyCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    );
    const total = seats.length;

    const dotSpacing = 0.022; // normalised gap between dot centres
    const innerR = 0.06;

    // Merge parties below this seat count into a single "Others" wedge.
    // Why 10? Adjacent wedges need to sum to ≥ 42° at innerR=0.06 for
    // their innermost dots to clear each other (dotSpacing / innerR =
    // 0.367 rad minimum sweep for one dot to fit, × 2 neighbours).
    // SNP (9 seats) and everything below is adjacent to another tiny
    // party in the sort order, so they'd all overlap on their own.
    const TINY_THRESHOLD = 10;
    const bigParties = sortedParties.filter(([, n]) => n >= TINY_THRESHOLD);
    const tinyParties = sortedParties.filter(([, n]) => n < TINY_THRESHOLD);
    const othersCount = tinyParties.reduce((s, [, n]) => s + n, 0);

    type Wedge =
      | { kind: "party"; colour: string; count: number; startAngle: number; sweep: number }
      | { kind: "others"; tiny: [string, number][]; count: number; startAngle: number; sweep: number };

    const wedges: Wedge[] = bigParties.map(([colour, count]) => ({
      kind: "party" as const,
      colour,
      count,
      startAngle: 0,
      sweep: 0,
    }));
    if (othersCount > 0) {
      wedges.push({
        kind: "others" as const,
        tiny: tinyParties,
        count: othersCount,
        startAngle: 0,
        sweep: 0,
      });
    }

    // Assign each wedge its angular range (clockwise from 12 o'clock)
    let cumAngle = -Math.PI / 2;
    for (const w of wedges) {
      w.startAngle = cumAngle;
      w.sweep = (w.count / total) * Math.PI * 2;
      cumAngle += w.sweep;
    }

    // Seat-index queues per party so we can map slot → original index
    const partyQueues = new Map<string, number[]>();
    for (const [colour] of sortedParties) partyQueues.set(colour, []);
    for (let i = 0; i < seats.length; i++) {
      partyQueues.get(seats[i][2])!.push(i);
    }

    // Pack each wedge with concentric arcs. The Others wedge packs its
    // tiny-party seats together, each keeping its actual colour — so
    // every party stays visible, you just lose the wedge boundaries
    // for the very smallest groups.
    const piePositions: { x: number; y: number }[] = new Array(seats.length);
    for (const w of wedges) {
      const seatOrder: number[] =
        w.kind === "party"
          ? partyQueues.get(w.colour)!
          : w.tiny.flatMap(([colour]) => partyQueues.get(colour)!);

      let placed = 0;
      let ring = 0;
      while (placed < w.count) {
        const r = innerR + ring * dotSpacing;
        const arcLen = r * w.sweep;
        const dotsOnRing = Math.max(1, Math.floor(arcLen / dotSpacing));
        const toPlace = Math.min(dotsOnRing, w.count - placed);
        for (let j = 0; j < toPlace; j++) {
          const origIdx = seatOrder[placed];
          const angle = w.startAngle + w.sweep * ((j + 0.5) / dotsOnRing);
          piePositions[origIdx] = {
            x: 0.5 + r * Math.cos(angle),
            y: 0.5 + r * Math.sin(angle),
          };
          placed++;
        }
        ring++;
      }
    }

    // Pre-render a glow sprite per party colour. Used in the draw loop
    // with globalCompositeOperation = 'lighter' for an additive bloom
    // that intensifies as dots stack (dense urban constituencies).
    const hexToRgb = (hex: string): [number, number, number] => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const glowSpriteSize = 64;
    const glowSprites = new Map<string, HTMLCanvasElement>();
    for (const [colour] of sortedParties) {
      const sprite = document.createElement("canvas");
      sprite.width = glowSpriteSize;
      sprite.height = glowSpriteSize;
      const sctx = sprite.getContext("2d")!;
      const [r, g, b] = hexToRgb(colour);
      const grad = sctx.createRadialGradient(
        glowSpriteSize / 2, glowSpriteSize / 2, 0,
        glowSpriteSize / 2, glowSpriteSize / 2, glowSpriteSize / 2
      );
      grad.addColorStop(0.0, `rgba(${r},${g},${b},0.30)`);
      grad.addColorStop(0.35, `rgba(${r},${g},${b},0.12)`);
      grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, glowSpriteSize, glowSpriteSize);
      glowSprites.set(colour, sprite);
    }

    // 10s cycle: 4s map hold, 2s morph to pie, 2s pie hold, 2s morph back
    const CYCLE_MS = 10000;
    let animId: number;

    function ease(t: number): number {
      // Smooth ease in-out
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

      // Calculate morph factor: 0 = map, 1 = pie
      const cycleT = (now % CYCLE_MS) / CYCLE_MS;
      let morphT: number;

      // 0–0.4: map hold (4s), 0.4–0.6: morph to pie (2s),
      // 0.6–0.8: pie hold (2s), 0.8–1.0: morph back (2s)
      if (cycleT < 0.4) {
        morphT = 0;
      } else if (cycleT < 0.6) {
        morphT = ease((cycleT - 0.4) / 0.2);
      } else if (cycleT < 0.8) {
        morphT = 1;
      } else {
        morphT = 1 - ease((cycleT - 0.8) / 0.2);
      }

      // Scale map to fit with aspect ratio (UK is taller than wide)
      const mapAspect = latRange / lonRange * 1.6;
      const fitW = mapAspect > 1 ? w / mapAspect : w;
      const fitH = mapAspect > 1 ? h : h * mapAspect;
      const mapOffX = (w - fitW) / 2;
      const mapOffY = (h - fitH) / 2;

      const dotR = Math.min(w, h) * 0.006;

      // Glow pass — additive blend, strength scales with map phase.
      // Single dots give a faint halo; dense clusters bloom visibly
      // past the point of normal alpha saturation.
      const glowStrength = Math.max(0, 1 - morphT);
      if (glowStrength > 0.02) {
        const glowDiam = dotR * 6.4;
        ctx!.globalCompositeOperation = "lighter";
        ctx!.globalAlpha = glowStrength;
        for (let i = 0; i < seats.length; i++) {
          const mx = mapOffX + mapPositions[i].x * fitW;
          const my = mapOffY + mapPositions[i].y * fitH;
          const px = piePositions[i].x * w;
          const py = piePositions[i].y * h;
          const x = mx + (px - mx) * morphT;
          const y = my + (py - my) * morphT;
          const sprite = glowSprites.get(seats[i][2])!;
          ctx!.drawImage(sprite, x - glowDiam / 2, y - glowDiam / 2, glowDiam, glowDiam);
        }
        ctx!.globalCompositeOperation = "source-over";
        ctx!.globalAlpha = 1;
      }

      // Sharp dot pass — alpha blend keeps single dots crisp and
      // party-coloured; stacked overlaps already brighten to saturation.
      ctx!.globalAlpha = 0.78;
      for (let i = 0; i < seats.length; i++) {
        const mx = mapOffX + mapPositions[i].x * fitW;
        const my = mapOffY + mapPositions[i].y * fitH;
        const px = piePositions[i].x * w;
        const py = piePositions[i].y * h;

        const x = mx + (px - mx) * morphT;
        const y = my + (py - my) * morphT;

        ctx!.beginPath();
        ctx!.arc(x, y, dotR, 0, Math.PI * 2);
        ctx!.fillStyle = seats[i][2];
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [seats]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-label="650 UK constituencies morphing between map and party breakdown"
      role="img"
    />
  );
}
