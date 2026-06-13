"use client";

type Props = { src: string; poster: string; title: string };

export default function EpisodePlayer({ src, poster, title }: Props) {
  return (
    <video
      controls
      preload="metadata"
      poster={poster}
      aria-label={`Starting Henceforth — ${title}`}
      className="w-full rounded-xl border border-card-border bg-black shadow-lg"
    >
      <source src={src} type="video/mp4" />
      Your browser doesn’t support the video tag.
    </video>
  );
}
