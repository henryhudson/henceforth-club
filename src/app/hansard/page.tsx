import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";
import ConstituencyMorph from "@/components/ConstituencyMorph";
import Accordion from "@/components/Accordion";
import TechModal from "@/components/TechModal";
import HansardLatestWeek from "@/components/HansardLatestWeek";
import StoreButton from "@/components/StoreButton";
import PhoneShot from "@/components/PhoneShot";

const accordionSections = [
  {
    title: "Hansard",
    content: (
      <>
        <p>
          Hansard is a native iOS browser for the UK Parliament. Named after
          the official record of debates in the Commons and Lords, the app
          puts every MP, every Lord, and every constituency at your
          fingertips — with offline-first access to the data that matters.
        </p>
        <p>
          Built as a tool for the curious citizen, the researcher, and anyone
          who wants to understand how parliament actually works.
        </p>
      </>
    ),
  },
  {
    title: "Members",
    content: (
      <>
        <p>
          Browse every sitting MP and every member of the House of Lords.
          View party affiliation, constituency, parliamentary record, voting
          history, written questions, registered interests, biography, and
          Hansard speeches — all pulled from the official Parliament API.
        </p>
        <p>
          Filter by party, search by name, and tap through to detailed
          profiles with direct links to write to your MP.
        </p>
      </>
    ),
  },
  {
    title: "Constituencies",
    content: (
      <>
        <p>
          An interactive MapKit map with every UK constituency boundary drawn
          as a polygon overlay, coloured by the sitting member&apos;s
          political party. Zoom, pan, and tap to jump straight to your MP.
        </p>
        <p>
          Every one of the 650 constituencies is included, with boundaries
          and metadata bundled in the app — no network required.
        </p>
      </>
    ),
  },
  {
    title: "Offline-First",
    content: (
      <>
        <p>
          Hansard ships with bundled JSON snapshots of constituency
          boundaries and member data. The app works immediately on first
          launch, on the tube, or anywhere without a signal — then updates
          when you&apos;re back online.
        </p>
      </>
    ),
  },
];

export const metadata: Metadata = {
  title: "Hansard",
  description:
    "Every UK constituency on your phone. Works with no signal. 99p, once.",
};

// Structured data for search engines and AI crawlers — declares this
// page as an iOS app listing so it can show up as a rich result.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Hansard",
  operatingSystem: "iOS",
  applicationCategory: "ReferenceApplication",
  description:
    "Every UK constituency on your phone. Works with no signal. 99p, once.",
  url: "https://henceforth.club/hansard",
  downloadUrl: "https://apps.apple.com/app/the-hansard/id6762037651",
  offers: {
    "@type": "Offer",
    price: "0.99",
    priceCurrency: "GBP",
  },
  publisher: {
    "@type": "Organization",
    name: "Henceforth Bitcoin Limited",
    url: "https://henceforth.club",
  },
};

const features = [
  {
    icon: "🏛",
    title: "Members of the Commons",
    description:
      "Browse and search every sitting MP. View party affiliation, constituency, contact details, and portrait — all from the official Parliament API.",
  },
  {
    icon: "👑",
    title: "House of Lords",
    description:
      "Explore the full list of Lords, filtered by party or type. Life peers, hereditary peers, and bishops — all searchable and browsable.",
  },
  {
    icon: "🗺",
    title: "Constituency Map",
    description:
      "An interactive MapKit map with every UK constituency boundary drawn as a polygon overlay, coloured by the sitting member's political party.",
  },
  {
    icon: "📡",
    title: "Offline-First",
    description:
      "Bundled JSON snapshots of constituency boundaries and member data. The app works immediately on first launch — no network required.",
  },
  {
    icon: "🗳",
    title: "Voting History",
    description:
      "View how members voted in parliamentary divisions. Filter by date, topic, or member to see voting records at a glance.",
  },
  {
    icon: "📝",
    title: "Written Questions",
    description:
      "Browse parliamentary written questions and answers. Search by topic, member, or department to follow the detail of governance.",
  },
];

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="card-glow card-glow-green flex flex-col rounded-xl border border-card-border bg-card-bg/50 p-6 hover:border-card-border-hover transition-colors h-full">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted flex-1">{description}</p>
    </div>
  );
}

import { UK_SEATS as SEATS } from "@/lib/uk-seats";

export default function HansardPage() {
  return (
    <div className="py-20 sm:py-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <FadeIn>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="max-w-xl">
              <p className="text-xs tracking-widest text-accent-green/70 uppercase">
                iOS App
              </p>
              <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
                Hansard
              </h1>
              <p className="mt-3 text-sm tracking-wide text-accent-green/70">
                See how they treat you.
              </p>
              <p className="mt-6 text-lg leading-relaxed text-muted">
                Every constituency on your phone. Works with no signal.
                99p, once.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3">
                <StoreButton
                  href="https://apps.apple.com/app/the-hansard/id6762037651"
                  accent="green"
                />
                <p className="text-xs text-muted/60">
                  One purchase · Commons, Lords, and the map · no subscription
                </p>
              </div>
            </div>
            <PhoneShot
              src="/apps/hansard-map.jpg"
              alt="The Hansard constituency map on iPhone, coloured by party, with a search bar."
            />
          </div>
        </FadeIn>

        {/* Constituency morph — website demo, after the phone */}
        <FadeIn delay={0.15}>
          <div className="mt-16 flex flex-col items-center">
            <div className="w-64 h-80 sm:w-80 sm:h-96">
              <ConstituencyMorph seats={SEATS} />
            </div>
            <p className="mt-4 text-xs tracking-wide text-muted/60 text-center max-w-sm">
              650 seats — map ↔ party share. Parties with fewer than 10 seats
              are grouped into a single wedge, each dot keeping its party
              colour.
            </p>
          </div>
        </FadeIn>

        {/* Learn more accordion */}
        <div className="mt-16">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              Learn more
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mt-8">
              <Accordion sections={accordionSections} accentClass="text-accent-green" />
            </div>
          </FadeIn>
        </div>

        {/* Features grid */}
        <div className="mt-24">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              Features
            </p>
          </FadeIn>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <FadeIn key={feature.title} delay={i * 0.08} className="h-full">
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
              The animation above renders 650 constituency dots that morph
              between a UK map and a party-share pie chart. Read how it&apos;s
              put together.
            </p>
            <div className="mt-6">
              <TechModal accent="green" buttonLabel="How the morph works">
                <h3>Single canvas, two pre-computed layouts</h3>
                <p>
                  The animation interpolates between two static layouts:{" "}
                  <strong>map</strong> positions (normalised longitude/latitude)
                  and <strong>pie</strong> positions (concentric arcs grouped
                  by party). Both are computed once on mount. The render loop
                  blends per-dot positions with a single eased{" "}
                  <code>morphT</code> ∈ [0, 1].
                </p>

                <h3>Packing the pie</h3>
                <p>
                  Parties are sorted largest-to-smallest and laid out clockwise
                  from 12 o&apos;clock. Each wedge is filled with concentric
                  rings starting at <code>innerR = 0.06</code>, spaced{" "}
                  <code>0.022</code> apart. Each ring fits as many dots as its
                  arc length allows.
                </p>
                <p>
                  Parties with fewer than 10 seats get merged into a single{" "}
                  <strong>Others</strong> wedge — adjacent micro-parties
                  don&apos;t have enough angular sweep for their innermost dots
                  to clear neighbours. Every dot still keeps its own party
                  colour, so nothing visually disappears.
                </p>

                <h3>The bloom is not a filter</h3>
                <p>
                  Each party has a pre-rendered radial-gradient sprite. The
                  render loop draws those sprites with{" "}
                  <code>globalCompositeOperation = &quot;lighter&quot;</code>,
                  then a sharp dot on top at 0.78 alpha. Sparse rural seats
                  get a faint halo; dense urban clusters stack their gradients
                  and bloom visibly past saturation — the colour intensity
                  becomes a density readout.
                </p>

                <h3>Reduced-motion path</h3>
                <p>
                  A{" "}
                  <code>
                    matchMedia(&quot;(prefers-reduced-motion: reduce)&quot;)
                  </code>{" "}
                  check at startup paints one static map frame and skips the
                  requestAnimationFrame loop entirely. Screen readers see a
                  labelled <code>&lt;canvas role=&quot;img&quot;&gt;</code>{" "}
                  regardless.
                </p>

                <h3>Cycle and data</h3>
                <p>
                  10s total: 4s map hold, 2s morph, 2s pie hold, 2s morph back.
                  Each morph segment is eased with a smooth in-out cubic. The
                  data — 650 triples of [longitude, latitude, party-colour] —
                  ships inline with the page, no network call.
                </p>
              </TechModal>
            </div>
          </FadeIn>
        </div>

        {/* Latest weekly digest */}
        <div className="mt-24">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-12 text-xs tracking-widest text-muted/50 uppercase">
              On the web
            </p>
            <p className="mt-4 mb-8 max-w-2xl text-sm leading-relaxed text-muted">
              Every week we publish a digest of Commons divisions and written
              questions — free to read, no app required.
            </p>
            <HansardLatestWeek />
            <p className="mt-6 text-sm text-muted/60">
              <Link
                href="/hansard/this-week"
                className="transition-colors hover:text-accent-green"
              >
                Browse every issue →
              </Link>
              {" · "}
              <Link
                href="/articles/hansard-is-live"
                className="transition-colors hover:text-accent-green"
              >
                Launch note
              </Link>
              {" · "}
              <Link
                href="/hansard/privacy"
                className="transition-colors hover:text-accent-green"
              >
                Privacy
              </Link>
            </p>
          </FadeIn>
        </div>

        {/* CTA */}
        <FadeIn>
          <div className="mt-24 text-center">
            <div className="section-line mb-12" />
            <Image
              src="/icons/hansard.png"
              alt="Hansard app icon"
              width={80}
              height={80}
              className="mx-auto mb-6 rounded-2xl shadow-lg shadow-accent-green/10"
            />
            <p className="text-xs text-muted/50 mb-2 tracking-wider uppercase">
              Available now
            </p>
            <p className="mb-6 text-sm text-foreground/80">
              One purchase · 99p · everything unlocked, no subscription
            </p>
            <a
              href="https://apps.apple.com/app/the-hansard/id6762037651"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full border border-card-border bg-card-bg/50 px-8 py-4 text-sm text-muted hover:border-accent-green hover:text-foreground hover:shadow-lg hover:shadow-accent-green/10 transition-all"
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
