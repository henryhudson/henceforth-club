"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

const GREEN: [number, number, number] = [0.486, 0.808, 0.165]; // #7cce2a

const HQ: [number, number] = [51.5, -0.13]; // London

const SOURCES: [number, number][] = [
  [-1.29, 36.82], // Nairobi, Kenya — founding origin
  [31.79, -7.09], // Morocco
  [30.04, 31.24], // Egypt
  [14.5, -90.25], // Guatemala
  [-12.05, -77.04], // Peru
  [14.69, -17.45], // Senegal
  [40.42, -3.7], // Spain
];

const MARKERS = [
  { location: HQ, size: 0.09 },
  ...SOURCES.map((location) => ({ location, size: 0.06 })),
];

const ARCS = SOURCES.map((to) => ({ from: HQ, to, color: GREEN }));

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let phi = 0;
    let raf = 0;
    const px = () => Math.max(canvas.offsetWidth, 1) * 2;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: px(),
      height: px(),
      phi: 0,
      theta: 0.25,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 18000,
      mapBrightness: 5,
      mapBaseBrightness: 0.06,
      baseColor: [0.16, 0.19, 0.16], // dark charcoal-green sphere
      markerColor: GREEN,
      glowColor: [0.72, 0.85, 0.6], // soft green rim
      markers: MARKERS,
      arcs: ARCS,
      arcColor: GREEN,
    });

    const frame = () => {
      const w = px();
      phi += 0.004;
      globe.update({ phi, width: w, height: w });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      globe.destroy();
    };
  }, []);

  return (
    <div className="mx-auto aspect-square w-full max-w-[460px]">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ contain: "layout paint size" }}
        aria-label="Globe showing Provenance's global sourcing network"
      />
    </div>
  );
}
