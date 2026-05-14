import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Long-form technical writing from Henceforth — BSV wallet design, FORTH, Bitcoin Script, and related work.",
};

const articles = [
  {
    href: "/articles/transactions-in-henceforth",
    title: "Transactions in Henceforth",
    blurb:
      "Three surfaces, one primitive — basic sends, multi-output payments, and raw-transaction hand-passing in the Henceforth wallet. Implementing Satoshi's framing and Wright's batching architecture.",
    date: "2026",
  },
];

export default function ArticlesPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <p className="text-xs uppercase tracking-widest text-accent-warm/70">
            Long-form
          </p>
          <h1 className="mt-6 text-5xl font-bold text-foreground sm:text-7xl">
            Articles
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Technical writing on BSV wallet design, FORTH, Bitcoin Script,
            and the Henceforth implementation.
          </p>
        </FadeIn>

        <div className="mt-16 space-y-4">
          {articles.map((article, i) => (
            <FadeIn key={article.href} delay={0.1 + i * 0.1}>
              <Link
                href={article.href}
                className="card-glow card-glow-warm group block rounded-xl border border-card-border bg-card-bg/50 p-6 transition-colors hover:border-accent-warm"
              >
                <p className="text-[10px] uppercase tracking-widest text-accent-warm/70">
                  {article.date}
                </p>
                <h2 className="mt-2 text-xl font-bold text-foreground sm:text-2xl">
                  {article.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                  {article.blurb}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted/70 transition-colors group-hover:text-accent-warm">
                  Read
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
      </div>
    </div>
  );
}
