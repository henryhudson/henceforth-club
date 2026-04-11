import type { Metadata } from "next";
import Image from "next/image";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Henceforth",
  description:
    "A Forth-2012 compliant interpreter with an integrated Bitcoin SV wallet for iOS.",
};

const features = [
  {
    num: "133",
    label: "CORE Words",
    description:
      "Full Forth-2012 CORE compliance. Stack operations, arithmetic, comparison, control flow, defining words, pictured output, and more.",
  },
  {
    num: "350+",
    label: "Total Vocabulary",
    description:
      "Beyond the standard: 140+ Bitcoin Script opcodes, transaction builder words, blockchain API access, graph plotting, and file management.",
  },
  {
    num: "BRC-42",
    label: "Key Derivation",
    description:
      "Type42 key derivation for deterministic address generation. Send and receive BSV with modern cryptographic key management.",
  },
  {
    num: "SPV",
    label: "Verification",
    description:
      "Simplified Payment Verification built in. Merkle proofs validate transactions without trusting a third party — exactly as Satoshi described.",
  },
  {
    num: "ARC",
    label: "Broadcasting",
    description:
      "Direct transaction broadcasting via ARC with automatic failover. Build, sign, and broadcast transactions from the FORTH terminal.",
  },
  {
    num: "BRC-2",
    label: "Encryption",
    description:
      "End-to-end message encryption using ECIES. Wire-compatible with the BSV SDK. Paymail support with BRC-30 peer-to-peer protocol.",
  },
];

function FeatureCard({
  num,
  label,
  description,
}: {
  num: string;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg/50 p-6 hover:border-card-border-hover transition-colors">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-accent-warm">{num}</span>
        <span className="text-xs text-muted/50 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}

function TerminalDemo() {
  return (
    <div className="terminal-window relative terminal-scanlines">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border/50">
        <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-xs text-muted/50">henceforth</span>
      </div>
      <div className="p-6 text-sm leading-[2.2] text-muted/60">
        <p>
          <span className="text-accent-warm glow-warm">$</span>{" "}
          <span className="text-foreground">2 3 + .</span>
        </p>
        <p className="text-terminal-green">5 ok.</p>
        <p>
          <span className="text-accent-warm glow-warm">$</span>{" "}
          <span className="text-foreground">: square dup * ;</span>
        </p>
        <p className="text-terminal-green">ok.</p>
        <p>
          <span className="text-accent-warm glow-warm">$</span>{" "}
          <span className="text-foreground">7 square .</span>
        </p>
        <p className="text-terminal-green">49 ok.</p>
        <p className="mt-2 text-muted/30">
          ── Bitcoin ──────────────────────────
        </p>
        <p>
          <span className="text-accent-warm glow-warm">$</span>{" "}
          <span className="text-foreground">wallet-balance .</span>
        </p>
        <p className="text-terminal-green">1,250,000 sats ok.</p>
        <p>
          <span className="text-accent-warm glow-warm">$</span>{" "}
          <span className="text-foreground">tx-new 10000 make-p2pkh-script tx-add-output tx-broadcast</span>
        </p>
        <p className="text-terminal-green">Transaction broadcast. txid: 3a7f...c9e1 ok.</p>
        <p>
          <span className="text-accent-warm glow-warm">$</span>{" "}
          <span className="cursor-blink text-foreground">_</span>
        </p>
      </div>
    </div>
  );
}

export default function HenceforthPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-xs tracking-widest text-accent-warm/70 uppercase">
              iOS App
            </p>
            <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
              Henceforth
            </h1>
            <p className="mt-3 text-sm tracking-wide text-accent-warm/70">
              Bitcoin meets Forth.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-muted max-w-2xl">
              A full{" "}
              <strong className="text-foreground font-medium">
                Forth-2012 compliant
              </strong>{" "}
              interpreter with an integrated{" "}
              <strong className="text-foreground font-medium">
                Bitcoin SV wallet
              </strong>
              , running natively on your iPhone and iPad.
            </p>
          </div>
        </FadeIn>

        {/* Terminal demo */}
        <FadeIn delay={0.15}>
          <div className="mt-16 max-w-3xl">
            <TerminalDemo />
          </div>
        </FadeIn>

        {/* Features grid */}
        <div className="mt-24">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              Capabilities
            </p>
          </FadeIn>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <FadeIn key={feature.num} delay={i * 0.08}>
                <FeatureCard {...feature} />
              </FadeIn>
            ))}
          </div>
        </div>

        {/* Documentation */}
        <div className="mt-24">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              Documentation
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted max-w-2xl">
              Complete reference for all FORTH words by category, Bitcoin Script
              opcodes, wallet architecture, transaction building, and more.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <a
                href="/hforth.pdf"
                download
                className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg/50 px-6 py-3 text-sm text-muted hover:border-accent-warm hover:text-foreground transition-all"
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
        </div>

        {/* CTA */}
        <FadeIn>
          <div className="mt-24 text-center">
            <div className="section-line mb-12" />
            <Image
              src="/icons/henceforth.png"
              alt="Henceforth app icon"
              width={80}
              height={80}
              className="mx-auto mb-6 rounded-2xl shadow-lg shadow-accent-warm/10"
            />
            <p className="text-xs text-muted/50 mb-6 tracking-wider uppercase">
              Available now
            </p>
            <a
              href="https://apps.apple.com/app/henceforth/id1602896145"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full border border-card-border bg-card-bg/50 px-8 py-4 text-sm text-muted hover:border-accent-warm hover:text-foreground hover:shadow-lg hover:shadow-accent-warm/10 transition-all"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download on the App Store
            </a>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
