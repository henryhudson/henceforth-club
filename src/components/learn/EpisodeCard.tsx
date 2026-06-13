import Link from "next/link";
import { formatDuration, type Episode } from "@/lib/episodes";

export default function EpisodeCard({ episode }: { episode: Episode }) {
  const meta = [
    formatDuration(episode.durationSec),
    episode.music ? `${episode.music.season} · ${episode.music.piece}` : undefined,
  ]
    .filter(Boolean)
    .join("  ·  ");

  if (!episode.published) {
    return (
      <div className="flex flex-col rounded-xl border border-card-border bg-card-bg/30 p-5 opacity-60">
        <span className="text-[10px] uppercase tracking-widest text-muted/60">
          Episode {episode.number}
        </span>
        <span className="mt-2 text-base font-medium text-foreground">{episode.title}</span>
        <span className="mt-1 text-xs text-muted/50">Coming soon</span>
      </div>
    );
  }

  return (
    <Link
      href={`/learn/${episode.slug}`}
      className="card-glow card-glow-warm group flex flex-col overflow-hidden rounded-xl border border-card-border bg-card-bg/50 transition-colors hover:border-accent-warm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/learn/${episode.slug}/opengraph-image`}
        alt={`${episode.title} — poster`}
        className="aspect-[1200/630] w-full object-cover"
      />
      <div className="p-5">
        <span className="text-[10px] uppercase tracking-widest text-accent-warm/70">
          Episode {episode.number}
        </span>
        <span className="mt-2 block text-base font-medium text-foreground">{episode.title}</span>
        <span className="mt-1 block text-xs text-muted/60">{meta}</span>
      </div>
    </Link>
  );
}
