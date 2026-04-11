"use client";

import { useEffect, useRef } from "react";

/**
 * Party dots animation.
 * 650 dots grouped by party, largest to smallest left to right.
 * Dots gently pulse in opacity.
 */

// Party colours and seat counts (2024 general election)
const PARTIES: { colour: string; seats: number; name: string }[] = [
  { colour: "#E4003B", seats: 411, name: "Labour" },
  { colour: "#0087DC", seats: 121, name: "Conservative" },
  { colour: "#FDBB30", seats: 72, name: "Liberal Democrat" },
  { colour: "#FDF38E", seats: 9, name: "SNP" },
  { colour: "#326760", seats: 7, name: "Sinn Féin" },
  { colour: "#8b949e", seats: 8, name: "Independent" },
  { colour: "#12B6CF", seats: 5, name: "Reform UK" },
  { colour: "#D46A4C", seats: 5, name: "DUP" },
  { colour: "#005B54", seats: 4, name: "Plaid Cymru" },
  { colour: "#2AA82A", seats: 4, name: "Green" },
  { colour: "#006B51", seats: 3, name: "SDLP" },
  { colour: "#48A5EE", seats: 1, name: "Alliance" },
];

export default function PartyDots({
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

      // Subtle pulse
      const pulse = 0.4 + 0.15 * Math.sin(now / 2000);

      const dotR = Math.min(w, h) * 0.012;
      const gap = dotR * 2.8;
      const cols = Math.floor(w / gap);

      let x = gap / 2;
      let y = gap / 2;

      for (const party of PARTIES) {
        ctx!.shadowColor = party.colour;
        ctx!.shadowBlur = 4;

        for (let i = 0; i < party.seats; i++) {
          if (x + dotR > w) {
            x = gap / 2;
            y += gap;
          }

          ctx!.beginPath();
          ctx!.arc(x, y, dotR, 0, Math.PI * 2);
          ctx!.fillStyle = party.colour;
          ctx!.globalAlpha = pulse;
          ctx!.fill();
          ctx!.globalAlpha = 1;

          x += gap;
        }
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
