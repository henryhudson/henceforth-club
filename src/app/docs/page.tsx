import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";
import { DOCS_HUB } from "@/lib/content-nav";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Henceforth documentation — FORTH word reference, wallet architecture, goals, and credits. Split into chapters for faster reading.",
};

export default function DocsHubPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <p className="text-xs uppercase tracking-widest text-accent-warm/70">
            Henceforth
          </p>
          <h1 className="mt-6 text-5xl font-bold text-foreground sm:text-7xl">
            Documentation
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Bitcoin meets Forth. Chapters below cover the app, the word
            reference, and the wallet — pick the path you need instead of
            scrolling one long page.
          </p>
        </FadeIn>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {DOCS_HUB.map((chapter, i) => (
            <FadeIn key={chapter.href} delay={0.05 + i * 0.05} className="h-full">
              <Link
                href={chapter.href}
                className="card-glow card-glow-warm group flex h-full flex-col rounded-xl border border-card-border bg-card-bg/50 p-6 transition-colors hover:border-accent-warm"
              >
                <span className="text-[10px] uppercase tracking-widest text-accent-warm/70">
                  {chapter.kicker}
                </span>
                <h2 className="mt-2 text-xl font-bold text-foreground">
                  {chapter.label}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                  {chapter.blurb}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted/70 transition-colors group-hover:text-accent-warm">
                  Open
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
              </Link>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.35}>
          <p className="mt-12 text-sm leading-relaxed text-muted">
            Looking for long-form design notes? See{" "}
            <Link
              href="/articles"
              className="text-accent-warm underline decoration-accent-warm/40 underline-offset-2 hover:decoration-accent-warm"
            >
              Articles
            </Link>
            . New to the stack? Start with{" "}
            <Link
              href="/learn"
              className="text-accent-warm underline decoration-accent-warm/40 underline-offset-2 hover:decoration-accent-warm"
            >
              Learn
            </Link>
            .
          </p>
        </FadeIn>
      </div>
    </div>
  );
}
