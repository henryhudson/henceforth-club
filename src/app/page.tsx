import Link from "next/link";
import FadeIn from "@/components/FadeIn";
import HeroTerminal from "@/components/HeroTerminal";
import AppCard from "@/components/AppCard";

const startHere = [
  {
    step: "1",
    title: "Try FORTH in 60 seconds",
    blurb: "Episode one of Starting Henceforth — postfix maths, words you teach, and a payment that reads like a sentence.",
    href: "/learn/what-is-henceforth",
    cta: "Watch episode 1",
    accent: "text-accent-warm",
  },
  {
    step: "2",
    title: "Use the wallet",
    blurb: "Henceforth — Forth-2012 interpreter with a Bitcoin SV wallet. One purchase for iPhone, iPad, and Mac.",
    href: "/henceforth",
    cta: "Henceforth · $9.99",
    accent: "text-accent-warm",
  },
  {
    step: "3",
    title: "Browse Parliament",
    blurb: "Hansard — Commons, Lords, and every constituency on a map. Offline from first launch.",
    href: "/hansard",
    cta: "Hansard · 99p",
    accent: "text-accent-green",
  },
  {
    step: "4",
    title: "Play cards",
    blurb: "Deck of Cards — multiplayer over Game Center, free core game, optional multiplayer subscription.",
    href: "/dadeckofcards",
    cta: "Deck of Cards · Free",
    accent: "text-accent",
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
              New to the club? Learn the stack, open the wallet, check
              Parliament, then play cards — in that order if you want the short
              path.
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
                title="Henceforth"
                tagline="FORTH interpreter + Bitcoin wallet · $9.99"
                description="A full Forth-2012 compliant interpreter with an integrated BSV wallet. Execute stack-based programs, build and broadcast Bitcoin transactions, and manage keys — all from an interactive terminal on your iPhone or iPad."
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
                description="A beautiful, multiplayer card game platform. Play classic card games with friends in real time. Custom decks, smooth animations, and a clean interface designed for the way you actually play cards."
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
                description="Browse Members of the Commons, the House of Lords, and every constituency on an interactive map — coloured by political party. Offline-first with bundled parliamentary data."
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
