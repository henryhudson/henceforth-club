import type { Metadata } from "next";
import Image from "next/image";
import FadeIn from "@/components/FadeIn";
import BeatingHeart from "@/components/BeatingHeart";
import Accordion from "@/components/Accordion";
import TechModal from "@/components/TechModal";
import StoreButton from "@/components/StoreButton";
import PhoneShot from "@/components/PhoneShot";

const accordionSections = [
  {
    title: "Deck of Cards",
    content: (
      <>
        <p>
          Deck of Cards is a beautiful, multiplayer card game platform for iOS.
          It started as a way to play cards with family across time zones, and
          grew into a flexible engine for classic card games on iPhone and
          iPad.
        </p>
        <p>
          Every interaction is designed to feel like physical cards — dealing,
          fanning, flipping, and gathering. No ads — just a clean deck in your
          pocket, free to play. Online multiplayer is an inexpensive optional
          subscription.
        </p>
      </>
    ),
  },
  {
    title: "Multiplayer",
    content: (
      <>
        <p>
          Play with friends in real time over Game Center. Host a game,
          invite others, and the cards update instantly on everyone&apos;s
          device. The multiplayer engine handles reconnection, late joiners,
          and card state syncing automatically.
        </p>
        <p>
          You can also play solo in Free Play mode — always free, useful for
          learning a new game or just shuffling through a deck. Online
          multiplayer is unlocked with an inexpensive subscription.
        </p>
      </>
    ),
  },
  {
    title: "Games",
    content: (
      <>
        <p>
          A growing library of classic card games, all playable with the same
          consistent interface. Learn new games with interactive tutorials
          that walk you through the rules as you play.
        </p>
        <p>
          Replay any hand to review your plays and step through each action.
        </p>
      </>
    ),
  },
  {
    title: "Custom Decks",
    content: (
      <>
        <p>
          Design your own card decks with the built-in deck editor. Start
          from a template or build one from scratch — every card face, suit,
          and back is customisable.
        </p>
      </>
    ),
  },
];

export const metadata: Metadata = {
  title: "Deck of Cards",
  description:
    "One table, everyone's cards. Play any card game together on iPhone and iPad. Free; multiplayer from 99p a month.",
};

// Structured data for search engines — tells Google/Bing this page
// represents an actual iOS app, so the App Store link can show up as a
// rich result with platform + publisher metadata.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Deck of Cards",
  operatingSystem: "iOS",
  applicationCategory: "GameApplication",
  description:
    "One table, everyone's cards. Play any card game together on iPhone and iPad. Free; multiplayer from 99p a month.",
  url: "https://henceforth.club/dadeckofcards",
  downloadUrl: "https://apps.apple.com/app/deck-of-cards/id1520654142",
  offers: {
    "@type": "Offer",
    price: "0",
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
    suit: "\u2660",
    title: "Multiplayer",
    description:
      "Play card games with friends in real time. Smooth, responsive multiplayer built for mobile.",
  },
  {
    suit: "\u2665",
    title: "Custom Decks",
    description:
      "Design and customise your own card decks with the built-in deck editor. Choose from templates or create from scratch.",
  },
  {
    suit: "\u2666",
    title: "Beautiful Animations",
    description:
      "Cards deal, flip, and fan with fluid spring animations. Every interaction feels natural and satisfying.",
  },
  {
    suit: "\u2663",
    title: "Multiple Games",
    description:
      "A growing library of classic card games, all playable with the same beautiful interface.",
  },
  {
    suit: "\u2660",
    title: "Game Replay",
    description:
      "Replay any hand to review your plays. Step through each action and learn from every game.",
  },
  {
    suit: "\u2665",
    title: "Tutorials",
    description:
      "Learn new games with built-in interactive tutorials that walk you through the rules as you play.",
  },
];

function CardFan() {
  const cards = [
    { rank: "A", suit: "\u2660", color: "text-foreground" },
    { rank: "K", suit: "\u2665", color: "text-red-500" },
    { rank: "Q", suit: "\u2666", color: "text-red-500" },
    { rank: "J", suit: "\u2663", color: "text-foreground" },
    { rank: "10", suit: "\u2665", color: "text-red-500" },
  ];

  return (
    <div className="flex justify-center items-end py-12 sm:py-16">
      {cards.map((card, i) => {
        const rotation = (i - 2) * 10;
        const translateY = Math.abs(i - 2) * 8;
        return (
          <div
            key={`${card.rank}${card.suit}`}
            className="playing-card relative w-20 h-32 sm:w-28 sm:h-44 rounded-xl flex flex-col items-center justify-center cursor-default"
            style={{
              transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
              marginLeft: i > 0 ? "-16px" : "0",
              zIndex: i,
            }}
          >
            <span
              className={`text-xs sm:text-sm font-bold absolute top-2 left-2.5 ${card.color}`}
            >
              {card.rank}
            </span>
            <span className={`text-2xl sm:text-4xl ${card.color}`}>
              {card.suit}
            </span>
            <span
              className={`text-xs sm:text-sm font-bold absolute bottom-2 right-2.5 rotate-180 ${card.color}`}
            >
              {card.rank}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FeatureCard({
  suit,
  title,
  description,
}: {
  suit: string;
  title: string;
  description: string;
}) {
  const isRed = suit === "\u2665" || suit === "\u2666";
  return (
    <div className="card-glow flex flex-col rounded-xl border border-card-border bg-card-bg/50 p-6 hover:border-card-border-hover transition-colors h-full">
      <div className="flex items-center gap-3">
        <span className={`text-xl ${isRed ? "text-red-500" : "text-foreground"}`}>
          {suit}
        </span>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted flex-1">{description}</p>
    </div>
  );
}

export default function DaDeckOfCardsPage() {
  return (
    <div className="relative py-20 sm:py-28 overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Beating heart — ported from CodeSlicing HeartShape */}
      <div className="absolute inset-0 flex items-start justify-end pointer-events-none">
        <div className="w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] -mr-[100px] sm:-mr-[50px] mt-[20px] sm:mt-[40px] opacity-50">
          <BeatingHeart />
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <FadeIn>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="max-w-xl">
              <p className="text-xs tracking-widest text-accent/70 uppercase">
                iOS App
              </p>
              <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
                Deck of Cards
              </h1>
              <p className="mt-3 text-sm tracking-wide text-accent/70">
                One table, everyone&apos;s cards.
              </p>
              <p className="mt-6 text-lg leading-relaxed text-muted">
                Play any card game together. The rules stay in your heads.
                Free on iPhone and iPad; multiplayer from 99p a month.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3">
                <StoreButton
                  href="https://apps.apple.com/app/deck-of-cards/id1520654142"
                  accent="accent"
                />
                <p className="text-xs text-muted/60">
                  Free to play · no ads ·{" "}
                  <a
                    href="/dadeckofcards/privacy"
                    className="underline decoration-card-border underline-offset-2 hover:text-accent"
                  >
                    Privacy
                  </a>
                </p>
              </div>
            </div>
            <PhoneShot
              src="/apps/deck-table.jpg"
              alt="A live table in Deck of Cards: a poker hand, two hole cards, and three friends around the felt."
            />
          </div>
        </FadeIn>

        {/* Card fan — website demo, after the phone */}
        <FadeIn delay={0.15}>
          <div className="mt-16">
            <CardFan />
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
              <Accordion sections={accordionSections} accentClass="text-accent" />
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
              Native iOS, real-time multiplayer over Game Center, spring-based
              animation throughout.
            </p>
            <div className="mt-6">
              <TechModal accent="cyan" buttonLabel="How it's built">
                <h3>Native iOS, built on Game Center</h3>
                <p>
                  Deck of Cards is a native iOS app. Real-time multiplayer is
                  built on Apple Game Center — host a game, invite players,
                  and card state syncs across every device in the room. The
                  multiplayer layer handles reconnection, late joiners, and
                  replay from any point in the hand.
                </p>

                <h3>Animation as physics, not transitions</h3>
                <p>
                  Every card interaction — dealing, fanning, flipping,
                  gathering — is spring-based. The goal is that the cards{" "}
                  <em>feel</em> like cards: a deal arcs, a flip rotates around
                  an axis with believable inertia, a fan responds to drag
                  with the right damping. UIKit-style fixed-curve transitions
                  don&apos;t get there.
                </p>

                <h3>Custom decks, custom rules</h3>
                <p>
                  The deck editor lets you replace any card face, suit, or
                  back with your own art. The rules engine is data-driven, so
                  adding a new game means declaring its rules — not writing a
                  new view controller per game.
                </p>

                <h3>One platform, no ads</h3>
                <p>
                  iPhone and iPad only. Free to play, with no ads and no
                  analytics SDKs that don&apos;t earn their keep. Online
                  multiplayer is an inexpensive optional subscription — from
                  $0.99 a month or $9.99 a year. Game Center handles
                  matchmaking; the app handles cards.
                </p>
              </TechModal>
            </div>
          </FadeIn>
        </div>

        {/* CTA */}
        <FadeIn>
          <div className="mt-24 text-center">
            <div className="section-line mb-12" />
            <Image
              src="/icons/dadeckofcards.png"
              alt="Deck of Cards app icon"
              width={80}
              height={80}
              className="mx-auto mb-6 rounded-2xl shadow-lg shadow-accent/10"
            />
            <p className="text-xs text-muted/50 mb-2 tracking-wider uppercase">
              Available now
            </p>
            <p className="mb-6 text-sm text-foreground/80">
              Free to play · multiplayer from $0.99/month or $9.99/year ·{" "}
              <a
                href="/dadeckofcards/privacy"
                className="text-muted/70 underline decoration-card-border underline-offset-2 hover:text-accent"
              >
                Privacy
              </a>
            </p>
            <a
              href="https://apps.apple.com/app/deck-of-cards/id1520654142"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full border border-card-border bg-card-bg/50 px-8 py-4 text-sm text-muted hover:border-accent hover:text-foreground hover:shadow-lg hover:shadow-accent/10 transition-all"
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
