import type { Metadata } from "next";
import Image from "next/image";
import FadeIn from "@/components/FadeIn";
import ExpandingCircles from "@/components/ExpandingCircles";
import Accordion from "@/components/Accordion";
import TechModal from "@/components/TechModal";

const accordionSections = [
  {
    title: "Henceforth",
    content: (
      <>
        <p>
          Henceforth is a pocket-sized programming environment built around
          FORTH — a minimal, stack-based language from 1970 that fits an entire
          interpreter into a few thousand lines of code. On iOS, that means
          you carry a real programming language in your pocket, not a
          playground or a sandbox.
        </p>
        <p>
          Write definitions, build stacks, save words, and compose new
          behaviours on the fly. The interpreter is Forth-2012 compliant, so
          anything you write works in any standard FORTH implementation on
          any platform.
        </p>
      </>
    ),
  },
  {
    title: "FORTH",
    content: (
      <>
        <p>
          FORTH is a concatenative language — programs are sequences of
          <em> words</em> that push, pop, and manipulate values on a shared
          stack. Define your own words with <code className="text-accent-warm">: name ... ;</code>{" "}
          and extend the language as you go.
        </p>
        <p>
          Henceforth ships with 133 CORE words from the standard, plus over
          200 extensions for graphics, file I/O, Bitcoin operations, and
          terminal control. Everything is interactive: type a word, see the
          stack, try another.
        </p>
      </>
    ),
  },
  {
    title: "Bitcoin",
    content: (
      <>
        <p>
          Built in, not bolted on. Henceforth includes a full Bitcoin SV
          wallet with Type42 (BRC-42) key derivation, SPV verification,
          direct ARC broadcasting, and BRC-2 encryption — all accessible as
          FORTH words. You can build, sign, and broadcast transactions from
          the command line.
        </p>
        <p>
          140+ Bitcoin Script opcodes are exposed as FORTH words, so you can
          compose locking scripts, simulate spending conditions, and
          experiment with the protocol interactively.
        </p>
      </>
    ),
  },
  {
    title: "Documentation",
    content: (
      <>
        <p>
          The full LaTeX reference manual documents every word by category,
          every Bitcoin Script opcode, the wallet architecture, and example
          programs. Download the PDF or read it alongside the app.
        </p>
      </>
    ),
  },
];

export const metadata: Metadata = {
  title: "Henceforth",
  description:
    "A Forth-2012 compliant interpreter with an integrated Bitcoin SV wallet for iOS.",
};

// Structured data for search engines — tells Google/Bing this page
// represents an actual iOS app, so the App Store link can show up as a
// rich result with platform + publisher metadata.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Henceforth",
  operatingSystem: "iOS",
  applicationCategory: "DeveloperApplication",
  description:
    "A Forth-2012 compliant interpreter with an integrated Bitcoin SV wallet for iOS.",
  url: "https://henceforth.club/henceforth",
  downloadUrl: "https://apps.apple.com/app/henceforth/id1602896145",
  offers: {
    "@type": "Offer",
    price: "9.99",
    priceCurrency: "USD",
  },
  publisher: {
    "@type": "Organization",
    name: "Henceforth Bitcoin Limited",
    url: "https://henceforth.club",
  },
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
    <div className="flex flex-col rounded-xl border border-card-border bg-card-bg/50 p-6 hover:border-card-border-hover transition-colors h-full">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-accent-warm">{num}</span>
        <span className="text-xs text-muted/50 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted flex-1">{description}</p>
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
          <span className="text-foreground">tx-new 10000 s&quot; 1A1z...fNa&quot; tx-add-output tx-broadcast</span>
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
    <div className="relative py-20 sm:py-28 overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Expanding circles — from CircleMath app */}
      <div className="absolute inset-0 flex items-start justify-end pointer-events-none">
        <div className="w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] -mr-[100px] sm:-mr-[50px] mt-[20px] sm:mt-[40px] opacity-50">
          <ExpandingCircles />
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
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

        {/* Learn more accordion */}
        <div className="mt-24">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              Learn more
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mt-8">
              <Accordion sections={accordionSections} accentClass="text-accent-warm" />
            </div>
          </FadeIn>
        </div>

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
              <FadeIn key={feature.num} delay={i * 0.08} className="h-full">
                <FeatureCard {...feature} />
              </FadeIn>
            ))}
          </div>
        </div>

        {/* Engineering */}
        <div className="mt-24">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              Engineering
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted max-w-2xl">
              Native Swift, end to end. The Bitcoin layer is built on the
              open-source SwiftBSV SDK.
            </p>

            <a
              href="https://github.com/henryhudson/SwiftBSV"
              target="_blank"
              rel="noopener noreferrer"
              className="card-glow card-glow-warm group mt-8 flex flex-col gap-4 rounded-xl border border-card-border bg-card-bg/50 p-6 hover:border-accent-warm transition-colors sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-muted/60 group-hover:text-foreground transition-colors"
                  fill="currentColor"
                >
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.96c-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.11 3.04.73.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.79.56C20.21 21.39 23.5 17.08 23.5 12c0-6.35-5.15-11.5-11.5-11.5z" />
                </svg>
                <span className="text-[10px] tracking-widest uppercase text-accent-warm/70">
                  Built with
                </span>
                <h3 className="font-bold text-foreground text-lg">SwiftBSV</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted flex-1">
                Open-source Swift SDK for Bitcoin SV — Type42 key derivation,
                SPV verification, ARC broadcast, BRC-2 encryption.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted/60 group-hover:text-accent-warm transition-colors">
                GitHub
                <svg
                  className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </a>

            <a
              href="https://github.com/henryhudson/SwiftBSV/blob/main/Documentation/swiftbsv.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-muted/70 transition-colors hover:text-accent-warm"
            >
              Read the SwiftBSV book (41 pages, PDF)
              <span aria-hidden="true">→</span>
            </a>

            <div className="mt-6">
              <TechModal accent="warm" buttonLabel="How it's built">
                <h3>Native Swift, end to end</h3>
                <p>
                  Henceforth is a native iOS app written in Swift — no React
                  Native, no web view wrapper. The FORTH interpreter runs
                  directly on the device, and the Bitcoin layer talks to the
                  network from the same process.
                </p>

                <h3>The interpreter</h3>
                <p>
                  Forth-2012 compliant — 133 CORE words plus 200+ extensions
                  for graphics, file I/O, Bitcoin operations, and terminal
                  control. Custom words are first-class: define{" "}
                  <code>: square dup * ;</code>, use it immediately, save it
                  to disk.
                </p>
                <p>
                  140+ Bitcoin Script opcodes are exposed as FORTH words, so
                  you can compose locking scripts, simulate spending
                  conditions, and step through opcode-level behaviour
                  interactively — not in a textbook.
                </p>

                <h3>Bitcoin via SwiftBSV</h3>
                <p>
                  The wallet layer is built on{" "}
                  <a
                    href="https://github.com/henryhudson/SwiftBSV"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    SwiftBSV
                  </a>
                  , an open-source Swift SDK for Bitcoin SV. Type42 (BRC-42)
                  key derivation gives deterministic addresses without
                  HD-wallet plumbing. SPV verification validates transactions
                  against block headers — Merkle proofs, no third-party
                  trust. ARC handles broadcasting with automatic failover.
                  BRC-2 (ECIES) encrypts messages wire-compatibly with the
                  TypeScript BSV SDK.
                </p>
                <p>
                  Because the wallet is exposed as FORTH words, you can build,
                  sign, and broadcast transactions from the terminal{" "}
                  (<code>tx-new ... tx-add-output tx-broadcast</code>) — the
                  interpreter treats Bitcoin as just another vocabulary.
                </p>
              </TechModal>
            </div>
          </FadeIn>
        </div>

        {/* Documentation & deep dives */}
        <div className="mt-24">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              Go deeper
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted max-w-2xl">
              Word reference, wallet architecture notes, and a ten-episode video
              series — the proof behind the product page.
            </p>
          </FadeIn>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                href: "/learn",
                title: "Learn",
                blurb: "Starting Henceforth — ten short episodes from the stack to Bitcoin Script.",
              },
              {
                href: "/docs/reference",
                title: "Word reference",
                blurb: "Every FORTH word and Bitcoin Script opcode as implemented in the app.",
              },
              {
                href: "/docs/wallet",
                title: "Wallet docs",
                blurb: "Trust domains, SPV headers, cold mode, and UTXO sync.",
              },
              {
                href: "/articles/trust-local-but-verify",
                title: "Trust Local, But Verify",
                blurb: "Why verified local state never shrinks from network silence.",
              },
              {
                href: "/articles/transactions-in-henceforth",
                title: "Transactions in Henceforth",
                blurb: "PayView, send / send-many, raw hex, and air-gap receipts.",
              },
              {
                href: "/henceforth/privacy",
                title: "Privacy",
                blurb: "Keys stay on device. No advertising SDKs.",
              },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-xl border border-card-border bg-card-bg/40 p-5 transition-colors hover:border-accent-warm"
              >
                <h3 className="text-sm font-semibold text-accent-warm">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{item.blurb}</p>
              </a>
            ))}
          </div>
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
            <p className="text-xs text-muted/50 mb-2 tracking-wider uppercase">
              Available now
            </p>
            <p className="mb-6 text-sm text-foreground/80">
              One purchase · $9.99 · iPhone, iPad, and Mac
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
