"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

const GREEN: [number, number, number] = [0.486, 0.808, 0.165]; // #7cce2a

const HQ: [number, number] = [51.5, -0.13]; // London

// Approximate sourcing regions for globally sourced exotic vegetables.
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
  { location: HQ, size: 0.08 },
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
    let size = canvas.offsetWidth;
    const onResize = () => {
      size = canvas.offsetWidth;
    };
    window.addEventListener("resize", onResize);

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: size * 2,
      height: size * 2,
      phi: 0,
      theta: 0.22,
      dark: 0,
      diffuse: 0.5,
      mapSamples: 18000,
      mapBrightness: 1.3,
      baseColor: [0.91, 0.92, 0.94],
      markerColor: GREEN,
      glowColor: [0.96, 0.98, 0.93],
      markers: MARKERS,
      arcs: ARCS,
      arcColor: GREEN,
    });

    const frame = () => {
      phi += 0.004;
      globe.update({ phi, width: size * 2, height: size * 2 });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      globe.destroy();
      window.removeEventListener("resize", onResize);
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
