import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

type OgOptions = {
  title: string;
  tagline: string;
  accent: string;
  accentGlow: string;
  path: string;
};

/**
 * Generates a 1200×630 OG card matching the site's Phosphor Noir aesthetic:
 * dark background, thin accent-coloured grid, corner glow, monospace type.
 * Used by per-route opengraph-image.tsx files so each app gets its own colour.
 */
export function ogImage({ title, tagline, accent, accentGlow, path }: OgOptions) {
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
            henceforth.club
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 128,
              fontWeight: 700,
              lineHeight: 1,
              color: "#ffffff",
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 36, color: "#9ca3af", lineHeight: 1.3, maxWidth: 900 }}>
            {tagline}
          </div>
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
          <div>iOS · Henceforth Bitcoin Limited</div>
          <div style={{ color: accent }}>{path}</div>
        </div>
      </div>
    ),
    ogSize
  );
}
