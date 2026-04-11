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

    // Assign each seat a pie-chart position
    const piePositions: { x: number; y: number }[] = new Array(seats.length);

    // Build a colour→angle-range mapping
    const partyRanges: { colour: string; startAngle: number; endAngle: number }[] = [];
    let cumAngle = -Math.PI / 2; // start at top
    for (const [colour, count] of sortedParties) {
      const sweep = (count / total) * Math.PI * 2;
      partyRanges.push({ colour, startAngle: cumAngle, endAngle: cumAngle + sweep });
      cumAngle += sweep;
    }

    // Place each seat's dot within its party's pie slice
    const partyIndex = new Map<string, number>();
    for (const [colour] of sortedParties) partyIndex.set(colour, 0);

    for (let i = 0; i < seats.length; i++) {
      const colour = seats[i][2];
      const range = partyRanges.find((r) => r.colour === colour)!;
      const count = partyCounts.get(colour)!;
      const idx = partyIndex.get(colour)!;
      partyIndex.set(colour, idx + 1);

      // Distribute dots in concentric rings within the slice
      const sweep = range.endAngle - range.startAngle;
      const midAngle = range.startAngle + sweep / 2;
      const ringCount = Math.ceil(Math.sqrt(count));
      const ring = Math.floor(idx / Math.max(ringCount, 1));
      const posInRing = idx % Math.max(ringCount, 1);
      const maxRings = Math.ceil(count / ringCount);

      const r = 0.15 + (ring / Math.max(maxRings, 1)) * 0.3;
      const angleSpread = sweep * 0.8;
      const angle =
        midAngle -
        angleSpread / 2 +
        (posInRing / Math.max(ringCount - 1, 1)) * angleSpread;

      piePositions[i] = {
        x: 0.5 + r * Math.cos(angle),
        y: 0.5 + r * Math.sin(angle),
      };
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
        ctx!.globalAlpha = 0.75;
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

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
