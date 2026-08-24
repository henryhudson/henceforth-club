import Link from "next/link";
import FadeIn from "@/components/FadeIn";
import HeroTerminal from "@/components/HeroTerminal";
import AppCard from "@/components/AppCard";

const startHere = [
  {
    step: "1",
    title: "Play cards",
    blurb: "One table, everyone's cards. Free on iPhone and iPad; multiplayer from 99p a month.",
    href: "/dadeckofcards",
    cta: "Deck of Cards · Free",
    accent: "text-accent",
  },
  {
    step: "2",
    title: "Browse Parliament",
    blurb: "Every constituency on your phone. Works with no signal. 99p, once.",
    href: "/hansard",
    cta: "Hansard · 99p",
    accent: "text-accent-green",
  },
  {
    step: "3",
    title: "Use the wallet",
    blurb: "A Bitcoin wallet you can program. Forth interpreter included. One purchase for iPhone, iPad, and Mac.",
    href: "/henceforth",
    cta: "Henceforth · $9.99",
    accent: "text-accent-warm",
  },
  {
    step: "4",
    title: "Try FORTH in 60 seconds",
    blurb: "Episode one of Starting Henceforth — postfix maths, words you teach, and a payment that reads like a sentence.",
    href: "/learn/what-is-henceforth",
    cta: "Watch episode 1",
    accent: "text-accent-warm",
  },
];

export default function Home() {
  return (
    <>
      <HeroTerminal />

      <div className="section-line" />

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <p className="text-xs tracking-widest text-muted/50 uppercase">
              Start here
            </p>
            <h2 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
              A clear ladder
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Start with the free deck if you want something tonight. Parliament
              is 99p. The wallet is a one-time purchase. Episode one is there if
              you want the long way in.
            </p>
          </FadeIn>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2">
            {startHere.map((item, i) => (
              <FadeIn key={item.href} delay={0.08 + i * 0.06} className="h-full">
                <li className="h-full list-none">
                  <Link
                    href={item.href}
                    className="group flex h-full flex-col rounded-xl border border-card-border bg-card-bg/40 p-6 transition-colors hover:border-card-border-hover"
                  >
                    <span className={`text-xs font-bold ${item.accent}`}>
                      {item.step}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                      {item.blurb}
                    </p>
                    <span className="mt-4 text-xs text-muted/60 transition-colors group-hover:text-foreground">
                      {item.cta} →
                    </span>
                  </Link>
                </li>
              </FadeIn>
            ))}
          </ol>
        </div>
      </section>

      <div className="section-line" />

      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <p className="text-xs tracking-widest text-muted/50 uppercase">
              Applications
            </p>
          </FadeIn>
          {/* Four products, two by two — a 3-column grid left the fourth card
              stranded alone on its own row. */}
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <FadeIn delay={0.1} className="h-full">
              <AppCard
                title="Deck of Cards"
                tagline="Multiplayer card games · Free to play"
                description="One table, everyone's cards. Play any card game together — the rules stay in your heads. Free; multiplayer from 99p a month."
                href="/dadeckofcards"
                store={{ kind: "download", url: "https://apps.apple.com/app/deck-of-cards/id1520654142" }}
                accentClass="text-accent"
                glowClass=""
                badge="iOS"
              />
            </FadeIn>
            <FadeIn delay={0.2} className="h-full">
              <AppCard
                title="Hansard"
                tagline="UK Parliament browser · 99p"
                description="Every constituency on your phone. Works with no signal. Commons, Lords, and the map. 99p, once."
                href="/hansard"
                store={{ kind: "download", url: "https://apps.apple.com/app/the-hansard/id6762037651" }}
                accentClass="text-accent-green"
                glowClass="card-glow-green"
                badge="iOS"
              />
            </FadeIn>
            <FadeIn delay={0.3} className="h-full">
              <AppCard
                title="Henceforth"
                tagline="FORTH interpreter + Bitcoin wallet · $9.99"
                description="A Bitcoin wallet you can program. Forth interpreter and Bitcoin SV wallet. One purchase for iPhone, iPad, and Mac."
                href="/henceforth"
                store={{ kind: "download", url: "https://apps.apple.com/app/henceforth/id1602896145" }}
                accentClass="text-accent-warm"
                glowClass="card-glow-warm"
                badge="iOS"
              />
            </FadeIn>
            <FadeIn delay={0.4} className="h-full">
              <AppCard
                title="Folklore"
                tagline="Content secured"
                description="Talk to descendants about information your ancestors desired to pass on. Your X profile, written to Bitcoin — readable from any block explorer, forever, and without us."
                href="/folklore"
                store={{ kind: "web" }}
                accentClass="text-accent-orange"
                glowClass=""
                badge="Web"
              />
            </FadeIn>
          </div>
        </div>
      </section>
    </>
  );
}
