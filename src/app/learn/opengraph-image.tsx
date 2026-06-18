import { ogImage, ogSize, ogContentType } from "@/lib/og";

export const size = ogSize;
export const contentType = ogContentType;
export const alt = "Learn Henceforth";

// The /learn gallery's share card. Uses the shared Phosphor-Noir helper so it
// matches the episode and app cards — title only, no episode count.
export default function Image() {
  return ogImage({
    title: "Learn Henceforth",
    tagline: "FORTH and Bitcoin, from first principles.",
    accent: "#fbbf24",
    accentGlow: "rgba(251,191,36,0.18)",
    path: "/learn",
  });
}
