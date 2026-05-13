import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";
import SectionNav from "@/components/SectionNav";
import { CONTENT_SECTIONS } from "@/lib/content-nav";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "Starting Henceforth — video tutorials teaching FORTH and the Henceforth Bitcoin wallet from first principles.",
};

export default function LearnPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <p className="text-xs uppercase tracking-widest text-accent/70">
            Tutorials
          </p>
          <h1 className="mt-6 text-5xl font-bold text-foreground sm:text-7xl">
            Learn
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Starting Henceforth — a video series teaching FORTH and the
            Henceforth Bitcoin wallet from first principles.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-10">
            <SectionNav sections={CONTENT_SECTIONS} />
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="mt-24 text-center text-sm text-muted/60">
            First episode coming soon.
          </p>
        </FadeIn>
      </div>
    </div>
  );
}
