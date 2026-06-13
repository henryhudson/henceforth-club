import { ogImage, ogSize, ogContentType } from "@/lib/og";
import { getEpisode, publishedEpisodes } from "@/lib/episodes";

export const size = ogSize;
export const contentType = ogContentType;
export const alt = "Starting Henceforth episode";

export function generateStaticParams() {
  return publishedEpisodes().map((e) => ({ slug: e.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ep = getEpisode(slug);
  const title = ep?.title ?? "Starting Henceforth";
  const tagline = ep ? `Episode ${ep.number} · Starting Henceforth` : "Starting Henceforth";
  return ogImage({
    title,
    tagline,
    accent: "#fbbf24",
    accentGlow: "rgba(251,191,36,0.18)",
    path: `/learn/${slug}`,
  });
}
