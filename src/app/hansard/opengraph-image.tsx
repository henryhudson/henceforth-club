import { ogImage, ogSize, ogContentType } from "@/lib/og";

export const size = ogSize;
export const contentType = ogContentType;
export const alt = "Hansard — UK Parliament browser for iOS";

export default function OG() {
  return ogImage({
    title: "Hansard",
    tagline: "Every constituency on your phone. Works with no signal. 99p, once.",
    accent: "#3da87a",
    accentGlow: "rgba(61, 168, 122, 0.22)",
    path: "/hansard",
  });
}
