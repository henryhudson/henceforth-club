import { statSync } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";

// Bust browser caches when the PDF actually changes: append the file's
// mtime as a query string. Resolved at build time (server component), so
// the URL is baked into the static HTML. Each PDF refresh → new URL →
// browsers re-fetch automatically instead of clinging to the old copy.
const pdfVersion = (() => {
  try {
    return statSync(path.join(process.cwd(), "public/hforth.pdf"))
      .mtimeMs.toString(36);
  } catch {
    return "";
  }
})();
const pdfUrl = `/hforth.pdf${pdfVersion ? `?v=${pdfVersion}` : ""}`;

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Henceforth documentation — complete reference for all FORTH words, Bitcoin wallet features, and scripting capabilities.",
};

const chapters = [
  {
    href: "/docs/about",
    number: "01",
    title: "About",
    blurb: "Links to source code and support channels.",
  },
  // Future chapters added here as they migrate to MDX.
];

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

        {/* Browse chapters — migrating from PDF to MDX, chapter by chapter */}
        <FadeIn delay={0.1}>
          <div className="mt-12">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-warm/80">
              Browse chapters
            </p>
            <ul className="mt-4 divide-y divide-card-border/40 border-t border-b border-card-border/40">
              {chapters.map((ch) => (
                <li key={ch.href}>
                  <Link
                    href={ch.href}
                    className="group flex items-baseline gap-4 py-4 transition-colors hover:bg-card-bg/40"
                  >
                    <span className="font-mono text-xs text-accent-orange/70">
                      {ch.number}
                    </span>
                    <span className="flex-1">
                      <span className="block text-base font-bold text-foreground group-hover:text-accent-warm">
                        {ch.title}
                      </span>
                      <span className="block text-sm text-muted">
                        {ch.blurb}
                      </span>
                    </span>
                    <span className="text-muted/40 group-hover:text-accent-warm">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted/60">
              Remaining chapters live in the PDF below — migrating to web pages
              one chapter at a time.
            </p>
          </div>
        </FadeIn>

        {/* Download link */}
        <FadeIn delay={0.2}>
          <div className="mt-12 flex items-center gap-4">
            <a
              href={pdfUrl}
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
              href={pdfUrl}
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
              data={pdfUrl}
              type="application/pdf"
              className="w-full"
              style={{ height: "80vh" }}
            >
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-muted">
                  Your browser doesn&apos;t support embedded PDFs.
                </p>
                <a
                  href={pdfUrl}
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
