import Link from "next/link";
import FadeIn from "@/components/FadeIn";
import HeroTerminal from "@/components/HeroTerminal";

function AppCard({
  title,
  tagline,
  description,
  href,
  accentClass,
  glowClass,
  badge,
}: {
  title: string;
  tagline: string;
  description: string;
  href: string;
  accentClass: string;
  glowClass: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className={`group card-glow ${glowClass} flex flex-col rounded-2xl border border-card-border bg-card-bg p-8 sm:p-10 hover:border-card-border-hover h-full sm:aspect-[1/1.618]`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs px-2.5 py-1 rounded-full border border-card-border bg-background/50 text-muted">
          {badge}
        </span>
      </div>
      <h2 className={`mt-6 text-2xl sm:text-3xl font-bold ${accentClass}`}>
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted/70">{tagline}</p>
      <p className="mt-6 text-sm leading-relaxed text-muted flex-1">{description}</p>
      <div className="mt-8 flex items-center gap-2 text-sm text-muted/50 group-hover:text-foreground transition-colors">
        <span>Explore</span>
        <svg
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </Link>
  );
}

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
                accentClass="text-accent-green"
                glowClass="card-glow-green"
                badge="iOS · Coming Soon"
              />
            </FadeIn>
          </div>
        </div>
      </section>
    </>
  );
}
