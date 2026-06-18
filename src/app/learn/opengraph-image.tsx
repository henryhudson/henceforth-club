import { ImageResponse } from "next/og";
import { ogSize, ogContentType } from "@/lib/og";
import { publishedEpisodes } from "@/lib/episodes";

export const size = ogSize;
export const contentType = ogContentType;
export const alt = "Starting Henceforth — learn FORTH in a real Bitcoin wallet";

// The /learn gallery's share card. Reuses the Phosphor Noir tokens from
// lib/og.tsx but adds a faux-terminal line (payment-as-a-word) so the whole
// premise reads at a glance. Episode count is live from the manifest.
const accent = "#fbbf24";
const accentGlow = "rgba(251,191,36,0.18)";

export default function Image() {
  const count = publishedEpisodes().length;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#06080a",
          color: "#e6edf3",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          backgroundImage: `
            radial-gradient(circle at 0% 0%, ${accentGlow}, transparent 45%),
            radial-gradient(circle at 100% 100%, ${accentGlow}, transparent 55%),
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "auto, auto, 60px 60px, 60px 60px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: accent,
              boxShadow: `0 0 20px ${accent}`,
            }}
          />
          <div style={{ fontSize: 22, letterSpacing: 4, color: accent, textTransform: "uppercase" }}>
            henceforth.club / learn
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 104,
              fontWeight: 700,
              lineHeight: 0.98,
              color: "#ffffff",
              letterSpacing: -2,
            }}
          >
            <div style={{ display: "flex" }}>Starting</div>
            <div style={{ display: "flex" }}>Henceforth</div>
          </div>
          <div style={{ fontSize: 34, color: "#9ca3af", lineHeight: 1.3, maxWidth: 980 }}>
            Learn FORTH inside a real Bitcoin wallet — one small word at a time, ending in Bitcoin Script.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "22px 28px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 30,
          }}
        >
          <span style={{ color: accent }}>ok ›</span>
          <span style={{ color: "#e6edf3" }}>: pay-rent  1000 s&quot; 1Q88…&quot; send ;</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#6b7280",
          }}
        >
          <div>{`${count} episodes free to watch · FORTH → Bitcoin Script`}</div>
          <div style={{ color: accent }}>/learn</div>
        </div>
      </div>
    ),
    ogSize
  );
}
