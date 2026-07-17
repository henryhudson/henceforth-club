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
  // og:image + twitter:image are auto-wired from opengraph-image.tsx — absolute via
  // the root layout's metadataBase, and content-hashed so they cache-bust on change.
  // Don't hardcode the URL (the generated route is /opengraph-image, not .png).
  return {
    title: ep.title,
    description: ep.dek,
    openGraph: {
      type: "video.other",
      title: ep.title,
      description: ep.dek,
      url,
      siteName: "Henceforth Club",
    },
    twitter: {
      card: "summary_large_image",
      title: ep.title,
      description: ep.dek,
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

        {/* Theater video — full content width */}
        <div className="mt-6">
          <EpisodePlayer src={ep.video.mp4} poster={poster} title={ep.title} />
        </div>

        {/* Title block */}
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-accent-warm/70">Episode {ep.number}</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">{ep.title}</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">{ep.dek}</p>
          {(ep.durationSec || ep.music) && (
            <p className="mt-2 text-xs text-muted/50">
              {[formatDuration(ep.durationSec), ep.music?.piece].filter(Boolean).join("  ·  ")}
            </p>
          )}
        </div>

        {/* Get the app */}
        <div className="mt-6">
          <GetHenceforth />
        </div>

        {/* Code along + learn / transcript */}
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-xs uppercase tracking-widest text-accent-warm/70">Code along</h2>
            <p className="mt-2 text-sm text-muted/70">Tap to copy, then type it into Henceforth.</p>
            <div className="mt-4">
              <CodeAlong commands={ep.codeAlong ?? []} />
            </div>
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-widest text-accent-warm/70">
              What you&rsquo;ll learn
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
              {(ep.concepts ?? []).map((c, i) => (
                <li key={i}>✓ {c}</li>
              ))}
            </ul>
            <div className="mt-8">
              <Transcript lines={ep.transcript ?? []} />
            </div>
          </div>
        </div>

        {/* The finale: only the last episode of the series carries the
            closing card — the journey named, and the graduate handed
            somewhere real. Ten episodes deserve an ending, not a footer. */}
        {!next && (
          <div className="mt-12 rounded-2xl border border-accent-warm/40 bg-card-bg p-8">
            <p className="text-xs uppercase tracking-widest text-accent-warm/80">
              The series, complete
            </p>
            <h2 className="mt-3 text-2xl font-bold text-foreground">
              Ten episodes. You started with{" "}
              <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-accent-warm">2 3 + .</code>{" "}
              — you finished by writing the lock that guards bitcoin.
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              Numbers, the stack, words of your own, decisions, loops, three stacks — and then a
              real script, byte for byte. Everything you typed still lives in your terminal, and
              everything bitcoin does is made of the same words.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <Link
                href="/folklore"
                className="font-mono text-accent-orange transition-opacity hover:opacity-75"
              >
                Put words on the chain for real — Folklore →
              </Link>
              <Link
                href="/learn/what-is-henceforth"
                className="font-mono text-muted/70 transition-colors hover:text-accent-warm"
              >
                Watch again from episode one ↺
              </Link>
            </div>
          </div>
        )}

        {/* Prev / next */}
        <div className="mt-12 flex items-center justify-between border-t border-card-border pt-6 text-sm">
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
  );
}
