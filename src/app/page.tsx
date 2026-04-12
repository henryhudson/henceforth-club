import Link from "next/link";
import FadeIn from "@/components/FadeIn";
import HeroTerminal from "@/components/HeroTerminal";

function AppleIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function AppCard({
  title,
  tagline,
  description,
  href,
  appStoreUrl,
  accentClass,
  glowClass,
  badge,
}: {
  title: string;
  tagline: string;
  description: string;
  href: string;
  appStoreUrl: string | null;
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
      <div className="mt-8 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-muted/50 group-hover:text-foreground transition-colors">
          Explore
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </span>
        {appStoreUrl ? (
          <a
            href={appStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-background/50 px-3 py-1.5 text-xs text-muted hover:border-foreground/40 hover:text-foreground transition-all"
            aria-label={`Download ${title} on the App Store`}
          >
            <AppleIcon />
            Download
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-background/30 px-3 py-1.5 text-xs text-muted/40 cursor-default"
            aria-label={`${title} coming soon`}
          >
            <AppleIcon />
            Coming soon
          </span>
        )}
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
    </>
  );
}
