import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";
import SectionNav from "@/components/SectionNav";
import { HENCEFORTH_NAV } from "@/lib/content-nav";

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Long-form technical writing from Henceforth — BSV wallet design, FORTH, Bitcoin Script, and related work.",
};

export default function ArticlesPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <p className="text-xs uppercase tracking-widest text-accent/70">
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

        <FadeIn delay={0.1}>
          <div className="mt-10">
            <SectionNav sections={HENCEFORTH_NAV} accent="warm" />
          </div>
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
