import Link from "next/link";
import FadeIn from "@/components/FadeIn";

function TerminalHero() {
  return (
    <section className="relative hero-gradient overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 hero-grid" />

      <div className="relative mx-auto max-w-6xl px-6 py-28 sm:py-40">
        {/* Editorial headline */}
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-sm tracking-widest text-accent/70 uppercase">
              iOS Apps
            </p>
            <h1 className="mt-6 text-4xl sm:text-6xl leading-[1.1] text-foreground font-bold">
              Code meets craft.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              A FORTH interpreter with a Bitcoin wallet. A multiplayer deck of cards.
              A UK Parliament browser. Three apps built with care, running natively on iOS.
            </p>
          </div>
        </FadeIn>

        {/* Terminal window */}
        <FadeIn delay={0.2}>
          <div className="mt-16 max-w-2xl">
            <div className="terminal-window relative terminal-scanlines">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border/50">
                <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs text-muted/50">henceforth</span>
              </div>
              {/* Terminal body */}
              <div className="p-6 text-sm leading-[2]">
                <p className="text-muted/60">
                  <span className="text-accent glow-cyan">$</span>{" "}
                  <span className="text-foreground">2 3 + .</span>
                </p>
                <p className="text-terminal-green">5 ok.</p>
                <p className="text-muted/60">
                  <span className="text-accent glow-cyan">$</span>{" "}
                  <span className="text-foreground">: greet .&quot; Hello, world!&quot; ;</span>
                </p>
                <p className="text-terminal-green">ok.</p>
                <p className="text-muted/60">
                  <span className="text-accent glow-cyan">$</span>{" "}
                  <span className="text-foreground">greet</span>
                </p>
                <p className="text-terminal-green">Hello, world! ok.</p>
                <p className="text-muted/60">
                  <span className="text-accent glow-cyan">$</span>{" "}
                  <span className="cursor-blink text-foreground">_</span>
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

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
      className={`group card-glow ${glowClass} block rounded-2xl border border-card-border bg-card-bg p-8 sm:p-10 hover:border-card-border-hover`}
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
      <p className="mt-6 text-sm leading-relaxed text-muted">{description}</p>
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
      <TerminalHero />

      <div className="section-line" />

      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <FadeIn>
            <p className="text-xs tracking-widest text-muted/50 uppercase">
              Applications
            </p>
          </FadeIn>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FadeIn delay={0.1}>
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
            <FadeIn delay={0.2}>
              <AppCard
                title="DaDeckOfCards"
                tagline="Multiplayer card games"
                description="A beautiful, multiplayer card game platform. Play classic card games with friends in real time. Custom decks, smooth animations, and a clean interface designed for the way you actually play cards."
                href="/dadeckofcards"
                accentClass="text-accent"
                glowClass=""
                badge="iOS"
              />
            </FadeIn>
            <FadeIn delay={0.3}>
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
