import type { Metadata } from "next";
import Image from "next/image";
import FadeIn from "@/components/FadeIn";
import BeatingHeart from "@/components/BeatingHeart";

export const metadata: Metadata = {
  title: "Deck of Cards",
  description: "A beautiful multiplayer card game platform for iOS.",
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
      {/* Beating heart — ported from CodeSlicing HeartShape */}
      <div className="absolute inset-0 flex items-start justify-end pointer-events-none">
        <div className="w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] -mr-[100px] sm:-mr-[50px] mt-[20px] sm:mt-[40px] opacity-50">
          <BeatingHeart />
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-xs tracking-widest text-accent/70 uppercase">
              iOS App
            </p>
            <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
              Deck of Cards
            </h1>
            <p className="mt-3 text-sm tracking-wide text-accent/70">
              A digital deck.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-muted max-w-2xl">
              A{" "}
              <strong className="text-foreground font-medium">
                multiplayer card game platform
              </strong>{" "}
              with smooth animations, custom decks, and a clean interface designed
              for the way you actually play cards.
            </p>
          </div>
        </FadeIn>

        {/* Card fan */}
        <FadeIn delay={0.15}>
          <div className="mt-8">
            <CardFan />
          </div>
        </FadeIn>

        {/* Features grid */}
        <div className="mt-16">
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
            <p className="text-xs text-muted/50 mb-6 tracking-wider uppercase">
              Available now — Free
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
