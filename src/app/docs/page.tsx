import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";
import SectionNav from "@/components/SectionNav";
import { CONTENT_SECTIONS, DOCS_CHAPTERS } from "@/lib/content-nav";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Henceforth documentation — complete reference for all FORTH words, Bitcoin wallet features, and scripting capabilities.",
};

const upcoming = [
  {
    number: "04",
    title: "Reference",
    blurb:
      "All FORTH words by category, Bitcoin Script opcodes. Migrating from the LaTeX source.",
  },
  {
    number: "05",
    title: "Bitcoin Wallet",
    blurb:
      "Architecture, transactions, UTXOs, API providers, security model.",
  },
];

export default function DocsPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <p className="text-xs uppercase tracking-widest text-accent/70">
            Reference
          </p>
          <h1 className="mt-6 text-5xl font-bold text-foreground sm:text-7xl">
            Documentation
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Complete reference for Henceforth — all FORTH words by category,
            Bitcoin Script opcodes, wallet architecture, transaction building,
            and more.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-10">
            <SectionNav sections={CONTENT_SECTIONS} subItems={DOCS_CHAPTERS} />
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <ul className="mt-12 divide-y divide-card-border/40 border-t border-b border-card-border/40">
            {DOCS_CHAPTERS.map((ch, i) => (
              <li key={ch.href}>
                <Link
                  href={ch.href}
                  className="group flex items-baseline gap-6 py-6 transition-colors hover:bg-card-bg/40"
                >
                  <span className="w-8 shrink-0 font-mono text-sm text-accent-orange/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg font-bold text-foreground group-hover:text-accent-warm">
                      {ch.label}
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      {ch.blurb}
                    </span>
                  </span>
                  <span className="text-lg text-muted/40 transition-colors group-hover:text-accent-warm">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn delay={0.3}>
          <p className="mt-16 text-xs uppercase tracking-[0.2em] text-muted">
            Coming next
          </p>
          <ul className="mt-4 space-y-1">
            {upcoming.map((ch) => (
              <li
                key={ch.number}
                className="flex items-baseline gap-6 py-3 opacity-50"
              >
                <span className="w-8 shrink-0 font-mono text-sm text-muted">
                  {ch.number}
                </span>
                <span className="flex-1">
                  <span className="block text-base font-bold text-muted">
                    {ch.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted/70">
                    {ch.blurb}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </div>
  );
}
