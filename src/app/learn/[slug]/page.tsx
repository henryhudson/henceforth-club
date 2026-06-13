import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EpisodePlayer from "@/components/learn/EpisodePlayer";
import CodeAlong from "@/components/learn/CodeAlong";
import GetHenceforth from "@/components/learn/GetHenceforth";
import Transcript from "@/components/learn/Transcript";
import { getEpisode, publishedEpisodes, adjacentEpisodes, formatDuration } from "@/lib/episodes";

export function generateStaticParams() {
  return publishedEpisodes().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ep = getEpisode(slug);
  if (!ep) return {};
  const url = `https://henceforth.club/learn/${slug}`;
  // Bump ?v= when the poster is regenerated — X caches og:image by URL string.
  const image = `${url}/opengraph-image.png?v=1`;
  return {
    title: ep.title,
    description: ep.dek,
    openGraph: {
      type: "video.other",
      title: ep.title,
      description: ep.dek,
      url,
      siteName: "Henceforth Club",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: ep.title,
      description: ep.dek,
      images: [image],
    },
  };
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ep = getEpisode(slug);
  if (!ep || !ep.published || !ep.video) notFound();

  const { prev, next } = adjacentEpisodes(slug);
  const poster = `/learn/${slug}/opengraph-image`;

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-6">
        <Link href="/learn" className="text-xs text-muted/60 transition-colors hover:text-accent-warm">
          ← Starting Henceforth
        </Link>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* LEFT — sticky player + get-app */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <EpisodePlayer src={ep.video.mp4} poster={poster} title={ep.title} />
            <div className="mt-5">
              <GetHenceforth />
            </div>
          </div>

          {/* RIGHT — content rail */}
          <div>
            <p className="text-xs uppercase tracking-widest text-accent-warm/70">
              Episode {ep.number}
            </p>
            <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">{ep.title}</h1>
            <p className="mt-3 text-base leading-relaxed text-muted">{ep.dek}</p>
            {(ep.durationSec || ep.music) && (
              <p className="mt-3 text-xs text-muted/50">
                {[formatDuration(ep.durationSec), ep.music?.piece].filter(Boolean).join("  ·  ")}
              </p>
            )}

            <h2 className="mt-10 text-xs uppercase tracking-widest text-accent-warm/70">Code along</h2>
            <p className="mt-2 text-sm text-muted/70">Tap to copy, then type it into Henceforth.</p>
            <div className="mt-4">
              <CodeAlong commands={ep.codeAlong ?? []} />
            </div>

            <h2 className="mt-10 text-xs uppercase tracking-widest text-accent-warm/70">
              What you&rsquo;ll learn
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
              {(ep.concepts ?? []).map((c, i) => (
                <li key={i}>✓ {c}</li>
              ))}
            </ul>

            <div className="mt-10">
              <Transcript lines={ep.transcript ?? []} />
            </div>

            <div className="mt-10 flex items-center justify-between border-t border-card-border pt-6 text-sm">
              {prev?.published ? (
                <Link href={`/learn/${prev.slug}`} className="text-muted/70 hover:text-accent-warm">
                  ← Ep {prev.number}
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                next.published ? (
                  <Link href={`/learn/${next.slug}`} className="text-muted/70 hover:text-accent-warm">
                    Ep {next.number} →
                  </Link>
                ) : (
                  <span className="text-muted/40">
                    Ep {next.number} · {next.title} — soon
                  </span>
                )
              ) : (
                <span />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
