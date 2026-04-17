import { ogImage, ogSize, ogContentType } from "@/lib/og";

export const size = ogSize;
export const contentType = ogContentType;
export const alt = "Hansard — UK Parliament browser for iOS";

export default function OG() {
  return ogImage({
    title: "Hansard",
    tagline: "Browse UK Parliament — Members, Lords, and constituencies on an interactive map. Native iOS.",
    accent: "#3da87a",
    accentGlow: "rgba(61, 168, 122, 0.22)",
    path: "/hansard",
  });
}
