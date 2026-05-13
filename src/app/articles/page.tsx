import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Long-form technical writing from Henceforth — BSV wallet design, FORTH, Bitcoin Script, and related work.",
};

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

        <FadeIn delay={0.2}>
          <p className="mt-24 text-center text-sm text-muted/60">
            First article shipping when the multi-output transactions
            piece is ready for publication.
          </p>
        </FadeIn>
      </div>
    </div>
  );
}
