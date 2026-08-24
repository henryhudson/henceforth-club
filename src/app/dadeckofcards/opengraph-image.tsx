import { ogImage, ogSize, ogContentType } from "@/lib/og";

export const size = ogSize;
export const contentType = ogContentType;
export const alt = "Deck of Cards — multiplayer card games";

export default function OG() {
  return ogImage({
    title: "Deck of Cards",
    tagline: "A beautiful, multiplayer card game platform. Play with friends in real time.",
    accent: "#e5484d",
    accentGlow: "rgba(229, 72, 77, 0.22)",
    path: "/dadeckofcards",
  });
}
