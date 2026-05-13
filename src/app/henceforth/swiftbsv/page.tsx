import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";
import SectionNav from "@/components/SectionNav";
import { HENCEFORTH_NAV } from "@/lib/content-nav";

export const metadata: Metadata = {
  title: "SwiftBSV",
  description:
    "The Swift SDK that powers every cryptographic operation in the Henceforth wallet — BIP-32/39, Type42, ECDSA, BSM, ECIES, transactions, SPV.",
};

export default function SwiftBSVPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <SectionNav sections={HENCEFORTH_NAV} accent="warm" />
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-12">
            <p className="text-xs uppercase tracking-widest text-accent-warm/70">
              SDK
            </p>
            <h1 className="mt-6 text-5xl font-bold text-foreground sm:text-7xl">
              SwiftBSV
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              The Swift SDK that powers every cryptographic operation in the
              Henceforth wallet — BIP-32 / BIP-39 key derivation, Type42
              (BRC-42) invoice keys, ECDSA signing, BSM, ECIES (BIE1 wire
              format), Script construction, the full BSV opcode set,
              transaction building, and SPV verification.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted/80">
              Originally written by Will Townsend at{" "}
              <a
                href="https://github.com/wtsnz/SwiftBSV"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-warm transition-colors hover:text-foreground"
              >
                wtsnz/SwiftBSV
              </a>
              ; the fork at{" "}
              <a
                href="https://github.com/henryhudson/SwiftBSV"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-warm transition-colors hover:text-foreground"
              >
                henryhudson/SwiftBSV
              </a>{" "}
              continues that foundation with Swift 6 strict concurrency, modern
              Apple platform targets, and a 41-page LaTeX book of its own.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="https://github.com/henryhudson/SwiftBSV"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg/50 px-5 py-2 text-sm text-muted transition-all hover:border-accent-warm hover:text-foreground"
            >
              GitHub repo
              <span aria-hidden="true">↗</span>
            </a>
            <a
              href="https://github.com/henryhudson/SwiftBSV/blob/main/Documentation/swiftbsv.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg/50 px-5 py-2 text-sm text-muted transition-all hover:border-accent-warm hover:text-foreground"
            >
              Read the book (41 pages, PDF)
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <p className="mt-16 text-sm text-muted/60">
            The SwiftBSV book will be migrated to web pages — for now it lives
            as a PDF on GitHub.
          </p>
        </FadeIn>
      </div>
    </div>
  );
}
