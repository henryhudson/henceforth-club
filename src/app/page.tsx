import FadeIn from "@/components/FadeIn";
import HeroTerminal from "@/components/HeroTerminal";
import AppCard from "@/components/AppCard";
import SectionNav from "@/components/SectionNav";
import { CONTENT_SECTIONS } from "@/lib/content-nav";

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
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FadeIn delay={0.1} className="h-full">
              <AppCard
                title="Henceforth"
                tagline="FORTH interpreter + Bitcoin wallet"
                description="A full Forth-2012 compliant interpreter with an integrated BSV wallet. Execute stack-based programs, build and broadcast Bitcoin transactions, and manage keys — all from an interactive terminal on your iPhone or iPad."
                href="/henceforth"
                appStoreUrl="https://apps.apple.com/app/henceforth/id1602896145"
                accentClass="text-accent-warm"
                glowClass="card-glow-warm"
                badge="iOS"
              />
            </FadeIn>
            <FadeIn delay={0.2} className="h-full">
              <AppCard
                title="Deck of Cards"
                tagline="Multiplayer card games"
                description="A beautiful, multiplayer card game platform. Play classic card games with friends in real time. Custom decks, smooth animations, and a clean interface designed for the way you actually play cards."
                href="/dadeckofcards"
                appStoreUrl="https://apps.apple.com/app/deck-of-cards/id1520654142"
                accentClass="text-accent"
                glowClass=""
                badge="iOS"
              />
            </FadeIn>
            <FadeIn delay={0.3} className="h-full">
              <AppCard
                title="Hansard"
                tagline="UK Parliament browser"
                description="Browse Members of the Commons, the House of Lords, and every constituency on an interactive map — coloured by political party. Offline-first with bundled parliamentary data."
                href="/hansard"
                appStoreUrl={null}
                accentClass="text-accent-green"
                glowClass="card-glow-green"
                badge="iOS · Coming Soon"
              />
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="pb-24 sm:pb-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="section-line" />
          <FadeIn>
            <p className="mt-16 text-xs tracking-widest text-muted/50 uppercase">
              Read more
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
              Documentation, long-form articles, and video tutorials.
            </p>
            <div className="mt-6">
              <SectionNav sections={CONTENT_SECTIONS} />
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
