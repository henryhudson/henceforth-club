import FadeIn from "@/components/FadeIn";
import HeroTerminal from "@/components/HeroTerminal";
import AppCard from "@/components/AppCard";

export default function Home() {
  return (
    <>
      <HeroTerminal />

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
            <FadeIn delay={0.2} className="h-full">
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
            <FadeIn delay={0.3} className="h-full">
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
