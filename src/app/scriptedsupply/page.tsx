import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";
import HeroDiagram from "./HeroDiagram";

export const metadata: Metadata = {
  title: "Scripted Supply",
  description:
    "Legible, replayable contracts for procurement on Bitcoin SV. A Henceforth product, in development.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

const capabilities = [
  {
    title: "Atomic delivery-versus-payment",
    body: "Payment moves only when delivery is cryptographically proven, in a single Bitcoin transaction. No half-completed trades, no invoices for goods never shipped, no goods delivered against invoices that get lost.",
  },
  {
    title: "Zero-install supplier portal",
    body: "Suppliers receive an email link, open it in any browser, and sign acceptance and delivery attestations with WebCrypto. The signing key lives in their device's IndexedDB. No wallet, no seed phrase, no install.",
  },
  {
    title: "Audit-replay artefacts",
    body: "Every saved contract emits Forth source, compiled Script hex, a source map linking them, auto-generated positive/negative test fixtures, and a dry-run trace — as one legal record a court can examine.",
  },
  {
    title: "Type42 per-PO privacy",
    body: "Fresh on-chain key for every purchase order, derived via BRC-42. Two POs from the same buyer-seller pair are structurally unlinkable to passive observers. Unlinkability falls out of ECDH, not storage discipline.",
  },
  {
    title: "GDPR right-to-erasure",
    body: "Encrypted payloads live off chain; only their SHA-256 hash is committed on chain. Destroying the off-chain ciphertext honours erasure obligations even though the ledger is immutable.",
  },
  {
    title: "Cryptographic dispute trail",
    body: "Disputes resolve against a non-repudiable cryptographic record: warehouse signature, customer scan-preimage, on-chain timing. Not against four EDI documents that disagree.",
  },
];

const forthSample = `CONTRACT-BEGIN scripted-supply.po.v1
  s" acme-warehouse@acme.com" counterparty
  s" zenith-stationery@zen.io" customer
  10000 unit-price-max
  500   quantity
  30 days-net payment-terms
  s" SKU-WIDGET-A" sku

  : ACCEPT-DELIVERY ( -- )
    require-warehouse-sig
    require-customer-scan-preimage
    delivery-attest ;

  : RELEASE-PAYMENT ( -- )
    require-customer-receipt
    require-after-delivery
    payment-release ;

  : DISPUTE ( reason -- )
    require-customer-sig
    7 days-after-delivery within
    dispute-flag ;
CONTRACT-END SCRIPT-SAVE acme-widget-500-v1`;

export default function ScriptedSupplyPage() {
  return (
    <main className="relative">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-32 sm:pt-28">
        <div className="text-center mb-12">
          <p className="text-xs sm:text-sm text-accent-orange/80 tracking-[0.3em] mb-6 animate-in delay-1">
            {"// A HENCEFORTH WHITEPAPER · IN DEVELOPMENT"}
          </p>
          <h1 className="text-5xl sm:text-7xl font-bold text-foreground mb-6 tracking-tight animate-in delay-2">
            Scripted{" "}
            <span className="text-accent-orange" style={{ textShadow: "0 0 32px rgba(232, 115, 30, 0.45)" }}>
              Supply
            </span>
          </h1>
          <p className="text-base sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed animate-in delay-3">
            Legible, replayable contracts for procurement on Bitcoin SV.
          </p>
        </div>

        <div className="animate-in delay-4">
          <HeroDiagram />
        </div>

        <div className="text-center mt-16">
          <p className="text-2xl sm:text-3xl font-bold text-foreground/90 animate-in delay-6">
            Where EDI ends,{" "}
            <span className="text-accent-orange">the ledger begins.</span>
          </p>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4 animate-in delay-7">
          <a
            href="/scripted-supply-whitepaper.pdf"
            className="group inline-flex items-center gap-3 rounded-md border border-accent-orange/60 bg-accent-orange/5 px-6 py-3 text-sm font-bold text-accent-orange transition-all hover:bg-accent-orange/15 hover:border-accent-orange"
          >
            <span>READ THE WHITEPAPER</span>
            <span className="text-base group-hover:translate-x-0.5 transition-transform">→</span>
          </a>
          <a
            href="#pilot"
            className="inline-flex items-center gap-3 rounded-md border border-card-border bg-card-bg/50 px-6 py-3 text-sm font-bold text-muted transition-colors hover:text-foreground hover:border-card-border-hover"
          >
            <span>PILOT TERMS</span>
          </a>
        </div>
      </section>

      {/* ── Why ──────────────────────────────────────────────── */}
      <section className="relative border-t border-card-border/50 bg-card-bg/20">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <FadeIn>
            <p className="text-xs text-accent-orange/70 tracking-[0.3em] mb-4">
              {"// THE PROBLEM"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8 leading-tight">
              Procurement runs on{" "}
              <span className="text-accent-orange">polite fictions.</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="text-foreground/80 text-lg leading-relaxed mb-6">
              Every B2B transaction today exchanges four documents: a purchase
              order, a shipping notice, an invoice, and a payment instruction.
              All four are syntactically correct. Any combination of them can be
              false. The system that produced them — EDI, designed in the early
              1980s — has no way of telling.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <blockquote className="my-12 border-l-2 border-accent-orange pl-6 py-2">
              <p className="text-xl sm:text-2xl text-foreground/90 italic leading-relaxed mb-3">
                EDI does not fail when it transmits incorrect information. It
                fails when it successfully transmits well-formed lies.
              </p>
              <footer className="text-sm text-muted not-italic">
                — Craig Wright,{" "}
                <a
                  href="https://singulargrit.substack.com/p/scripted-supply-a-bitcoin-based-architecture"
                  target="_blank"
                  rel="noopener"
                  className="underline decoration-dotted underline-offset-4 hover:text-accent-orange transition-colors"
                >
                  Scripted Supply: A Bitcoin-Based Architecture
                </a>
              </footer>
            </blockquote>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="text-foreground/80 text-lg leading-relaxed">
              Reconciling the fiction against reality consumes an estimated{" "}
              <span className="text-accent-orange font-bold">
                five to ten percent
              </span>{" "}
              of every B2B transaction value, in labour, dispute, and audit. For
              a mid-market business handling 1{",000"} purchase orders per
              month, the total cost runs to{" "}
              <span className="text-foreground font-bold">
                ~$90,000 per year
              </span>
              .
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── The Fix ──────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <FadeIn>
            <p className="text-xs text-accent-orange/70 tracking-[0.3em] mb-4">
              {"// THE FIX"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8 leading-tight">
              What if validation and execution were{" "}
              <span className="text-accent-orange">the same act?</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="text-foreground/80 text-lg leading-relaxed mb-6">
              Scripted Supply replaces the EDI settlement moment with
              cryptographically enforced state transitions on Bitcoin SV. Every
              purchase order is an on-chain UTXO. Its locking script encodes the
              exact conditions under which payment may move and ownership may
              transfer — opcode by opcode, enforced by consensus.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="text-foreground/80 text-lg leading-relaxed mb-6">
              Delivery is not a confirmation email; it is a cryptographic
              attestation signed by the warehouse and a scan-preimage produced
              by the customer at the moment of physical receipt. Payment is not
              a separate banking instruction; it is the same transaction that
              consumes the purchase order, atomically.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              <div className="rounded-lg border border-card-border bg-card-bg p-6">
                <p className="text-xs text-muted tracking-[0.2em] mb-2">
                  LEGACY EDI
                </p>
                <p className="text-foreground/80 leading-relaxed">
                  Payment can move without delivery. Delivery can be recorded
                  without payment. The two facts live in two databases and
                  disagree silently.
                </p>
              </div>
              <div className="rounded-lg border border-accent-orange/50 bg-accent-orange/5 p-6">
                <p className="text-xs text-accent-orange tracking-[0.2em] mb-2">
                  SCRIPTED SUPPLY
                </p>
                <p className="text-foreground/90 leading-relaxed">
                  Payment and delivery are bundled into one Bitcoin transaction.
                  Either both settle, or neither does. The pathology is
                  structurally impossible.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Forth-as-contract-language ───────────────────────── */}
      <section className="relative border-t border-card-border/50 bg-card-bg/20">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <FadeIn>
            <p className="text-xs text-accent-orange/70 tracking-[0.3em] mb-4">
              {"// THE DIFFERENTIATOR"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8 leading-tight">
              Contracts a procurement officer{" "}
              <span className="text-accent-orange">can read.</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="text-foreground/80 text-lg leading-relaxed mb-8 max-w-3xl">
              Bitcoin Script is a wall of hex to non-developers. An immutable
              contract nobody can read is a faith-based ritual, not a contract.
              Scripted Supply lets you write the contract in a restricted Forth
              dialect that compiles, deterministically, to the Script the chain
              enforces.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="terminal-window terminal-scanlines relative overflow-hidden">
              <div className="flex items-center gap-2 border-b border-card-border bg-background/40 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-card-border" />
                  <span className="h-2.5 w-2.5 rounded-full bg-card-border" />
                  <span className="h-2.5 w-2.5 rounded-full bg-card-border" />
                </div>
                <p className="ml-3 text-xs text-muted tracking-wider">
                  acme-widget-500-v1.ssforth
                </p>
              </div>
              <pre className="overflow-x-auto px-6 py-5 text-[13px] leading-relaxed text-terminal-green">
                <code>{forthSample}</code>
              </pre>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="text-foreground/80 text-lg leading-relaxed mt-8 max-w-3xl">
              The same artefact a CFO reads is, byte-for-byte, the artefact the
              chain executes. The compiler emits the source, the compiled hex, a
              source map between them, auto-generated tests, and a dry-run trace
              — bundled as one auditable record.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <FadeIn>
            <p className="text-xs text-accent-orange/70 tracking-[0.3em] mb-4">
              {"// CAPABILITIES"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-12 leading-tight">
              What the platform does.
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map((c, i) => (
              <FadeIn key={c.title} delay={i * 0.05}>
                <div className="group h-full rounded-lg border border-card-border bg-card-bg p-6 transition-all hover:border-accent-orange/60 hover:bg-card-bg/80">
                  <p className="text-[10px] text-accent-orange/70 tracking-[0.2em] mb-3">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="text-lg font-bold text-foreground mb-3 leading-snug group-hover:text-accent-orange transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{c.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Whitepaper ───────────────────────────────────────── */}
      <section className="relative border-t border-card-border/50 bg-card-bg/20">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <FadeIn>
            <p className="text-xs text-accent-orange/70 tracking-[0.3em] mb-4">
              {"// THE WHITEPAPER"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8 leading-tight">
              22 pages. The full architecture.
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="text-foreground/80 text-lg leading-relaxed mb-10 max-w-2xl">
              The thesis, the architectural fix, the asymmetric deployment, the
              Forth contract language, the privacy model, the worked economic
              example, and the pilot terms. Build on Craig Wright&apos;s foundational
              paper, expanded with the adoption and legibility layers it leaves
              open.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <a
              href="/scripted-supply-whitepaper.pdf"
              className="group block rounded-lg border border-accent-orange/40 bg-card-bg p-6 transition-all hover:border-accent-orange hover:bg-accent-orange/5"
            >
              <div className="flex items-start gap-5">
                <div className="rounded-md border border-accent-orange/60 bg-accent-orange/10 px-3 py-2 text-accent-orange text-xs font-bold tracking-wider">
                  PDF
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-foreground mb-1">
                    Scripted Supply — Legible, Replayable Contracts for
                    Procurement on Bitcoin SV
                  </p>
                  <p className="text-sm text-muted">
                    Henry Hudson · 22 pages · 129 KB ·{" "}
                    <span className="text-accent-orange/80">v0.1 · 2026</span>
                  </p>
                </div>
                <div className="text-accent-orange/60 group-hover:text-accent-orange group-hover:translate-x-1 transition-all text-2xl">
                  ↓
                </div>
              </div>
            </a>
          </FadeIn>
        </div>
      </section>

      {/* ── Pilot ────────────────────────────────────────────── */}
      <section id="pilot" className="relative">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <FadeIn>
            <p className="text-xs text-accent-orange/70 tracking-[0.3em] mb-4">
              {"// PILOT"}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8 leading-tight">
              Looking for anchor customer{" "}
              <span className="text-accent-orange">#1.</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <p className="text-foreground/80 text-lg leading-relaxed mb-10 max-w-2xl">
              One trading-partner relationship, migrated to Scripted Supply in
              eight weeks from contract signature. Real production purchase
              orders, on Bitcoin SV mainnet.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-4 mb-12">
            {[
              {
                k: "Three months free",
                v: "Zero subscription. Customer pays chain fees only (~$30/month at pilot volume).",
              },
              {
                k: "75% ROI exit gate",
                v: "If measured savings at month three fall below 75% of projection, customer exits at no cost — chain fees refunded.",
              },
              {
                k: "Eight-week build",
                v: "From contract signature to working bilateral channel: Forth contract authoring, supplier portal, first production POs.",
              },
            ].map((item, i) => (
              <FadeIn key={item.k} delay={0.2 + i * 0.05}>
                <div className="h-full rounded-lg border border-card-border bg-card-bg p-6">
                  <p className="text-base font-bold text-accent-orange mb-3">
                    {item.k}
                  </p>
                  <p className="text-sm text-muted leading-relaxed">
                    {item.v}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.4}>
            <div className="rounded-lg border border-accent-orange/40 bg-accent-orange/5 p-8 sm:p-10 text-center">
              <p className="text-sm text-muted tracking-[0.2em] mb-4">
                NEXT STEP — 30-MINUTE DISCOVERY CALL
              </p>
              <a
                href="mailto:henry@henceforth.club?subject=Scripted%20Supply%20pilot%20enquiry"
                className="inline-block text-2xl sm:text-3xl font-bold text-accent-orange hover:text-foreground transition-colors"
                style={{ textShadow: "0 0 24px rgba(232, 115, 30, 0.3)" }}
              >
                henry@henceforth.club
              </a>
              <p className="text-xs text-muted mt-4 tracking-wider">
                INITIAL CALLS RETURNED WITHIN TWO WORKING DAYS
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer note ──────────────────────────────────────── */}
      <section className="relative border-t border-card-border/30">
        <div className="mx-auto max-w-4xl px-6 py-10 text-center">
          <p className="text-xs text-muted/60 tracking-wider mb-2">
            BUILT ON{" "}
            <Link
              href="/henceforth"
              className="text-accent-warm/80 hover:text-accent-warm transition-colors"
            >
              HENCEFORTH
            </Link>{" "}
            — A BITCOIN SV PLATFORM FOR IOS AND MACOS
          </p>
          <p className="text-[10px] text-muted/40 tracking-wider">
            {"// scripted supply is in development. nothing on this page is a commitment to ship."}
          </p>
        </div>
      </section>
    </main>
  );
}
