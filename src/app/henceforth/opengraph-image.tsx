import { ogImage, ogSize, ogContentType } from "@/lib/og";

export const size = ogSize;
export const contentType = ogContentType;
export const alt = "Henceforth — FORTH interpreter + Bitcoin wallet";

export default function OG() {
  return ogImage({
    title: "Henceforth",
    tagline: "A FORTH-2012 interpreter with an integrated Bitcoin SV wallet. Stack-based programs, on your iPhone.",
    accent: "#fbbf24",
    accentGlow: "rgba(251, 191, 36, 0.22)",
    path: "/henceforth",
  });
}
