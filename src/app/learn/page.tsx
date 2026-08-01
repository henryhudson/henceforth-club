import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";
import EpisodeCard from "@/components/learn/EpisodeCard";
import { episodes } from "@/lib/episodes";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "Starting Henceforth taught FORTH and the Henceforth Bitcoin wallet from first principles. Thinking Henceforth continues the story every Sunday — money, on the same terminal. Plus Leo Brodie's classic FORTH books.",
};

const books = [
  {
    title: "Starting FORTH",
    author: "Leo Brodie",
    year: "1981",
    blurb:
      "The classic introduction to FORTH. Walks through the stack, defining words, and writing real programs — still the friendliest entry point to the language.",
    href: "https://www.forth.com/starting-forth/",
    cta: "Read free online",
  },
  {
    title: "Thinking FORTH",
    author: "Leo Brodie",
    year: "1984",
    blurb:
      "A book on software craftsmanship using FORTH as the medium — decomposition, factoring, naming, and the discipline of writing small composable words. Re-released by Brodie under an open licence.",
    href: "https://thinking-forth.sourceforge.net/",
    cta: "Download PDF",
  },
];

export default function LearnPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <p className="text-xs uppercase tracking-widest text-accent-warm/70">
            Tutorials
          </p>
          <h1 className="mt-6 text-5xl font-bold text-foreground sm:text-7xl">
            Learn
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Two seasons of short episodes — watch one, then code along in the
            app. Starting Henceforth taught the words; Thinking Henceforth,
            the Sunday series, puts them to work on money.
          </p>
        </FadeIn>

        <FadeIn>
          <p className="mt-12 text-xs uppercase tracking-widest text-accent-warm/70">
            Season one · Starting Henceforth
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Ten episodes from first principles to Bitcoin Script.
          </p>
        </FadeIn>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {episodes.filter((e) => e.number <= 10).map((episode, i) => (
            <FadeIn key={episode.slug} delay={0.1 + i * 0.08} className="h-full">
              <EpisodeCard episode={episode} />
            </FadeIn>
          ))}
        </div>

        {episodes.some((e) => e.number >= 11) && (
          <>
            <FadeIn>
              <p className="mt-16 text-xs uppercase tracking-widest text-accent-warm/70">
                Season two · Thinking Henceforth
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                The Sunday series. Spending Henceforth moves money — address,
                transaction, chain, trust — ending in one real spend, on
                camera, on the ledger forever.
              </p>
            </FadeIn>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {episodes.filter((e) => e.number >= 11).map((episode, i) => (
                <FadeIn key={episode.slug} delay={0.1 + i * 0.08} className="h-full">
                  <EpisodeCard episode={episode} />
                </FadeIn>
              ))}
            </div>
          </>
        )}

        <div className="mt-24">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs uppercase tracking-widest text-muted/50">
              FORTH
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
              Leo Brodie&rsquo;s books
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              Two essential FORTH books — both freely available, both still
              the best way to learn the language and its style of thinking
              more than forty years on.
            </p>
          </FadeIn>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {books.map((book, i) => (
              <FadeIn key={book.title} delay={0.1 + i * 0.1} className="h-full">
                <a
                  href={book.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-glow card-glow-warm group flex h-full flex-col rounded-xl border border-card-border bg-card-bg/50 p-6 transition-colors hover:border-accent-warm"
                >
                  <span className="text-[10px] uppercase tracking-widest text-accent-warm/70">
                    {book.title}
                  </span>
                  <span className="mt-2 text-base font-medium text-foreground">
                    {book.author} &middot; {book.year}
                  </span>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">
                    {book.blurb}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted/70 transition-colors group-hover:text-accent-warm">
                    {book.cta}
                    <span
                      aria-hidden="true"
                      className="inline-block transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </span>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
