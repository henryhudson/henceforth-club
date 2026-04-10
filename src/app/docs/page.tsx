import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Henceforth documentation — complete reference for all FORTH words, Bitcoin wallet features, and scripting capabilities.",
};

export default function DocsPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-xs tracking-widest text-accent/70 uppercase">
              Reference
            </p>
            <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
              Documentation
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted max-w-2xl">
              Complete reference for Henceforth — all FORTH words by category,
              Bitcoin Script opcodes, wallet architecture, transaction building,
              and more.
            </p>
          </div>
        </FadeIn>

        {/* Download link */}
        <FadeIn delay={0.1}>
          <div className="mt-8 flex items-center gap-4">
            <a
              href="/hforth.pdf"
              download
              className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg/50 px-6 py-3 text-sm text-muted hover:border-accent hover:text-foreground transition-all"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download PDF
            </a>
            <a
              href="/hforth.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted/50 hover:text-foreground transition-colors"
            >
              Open in new tab
            </a>
          </div>
        </FadeIn>

        {/* Embedded PDF */}
        <FadeIn delay={0.2}>
          <div className="mt-12 rounded-xl border border-card-border bg-card-bg overflow-hidden">
            <object
              data="/hforth.pdf"
              type="application/pdf"
              className="w-full"
              style={{ height: "80vh" }}
            >
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-muted">
                  Your browser doesn&apos;t support embedded PDFs.
                </p>
                <a
                  href="/hforth.pdf"
                  download
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg/50 px-6 py-3 text-sm text-accent hover:text-foreground transition-all"
                >
                  Download the PDF instead
                </a>
              </div>
            </object>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
