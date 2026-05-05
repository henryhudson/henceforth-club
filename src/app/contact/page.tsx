import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch — find us on X.",
};

const profiles = [
  {
    label: "Henceforth",
    handle: "@henceforth_app",
    href: "https://x.com/henceforth_app",
    color: "text-accent",
    glowClass: "",
    description: "App updates, FORTH tips, and Bitcoin.",
  },
  {
    label: "Deck of Cards",
    handle: "@cardsDeck",
    href: "https://x.com/cardsDeck",
    color: "text-accent-warm",
    glowClass: "card-glow-warm",
    description: "Game updates, new features, and multiplayer news.",
  },
  {
    label: "Henry Hudson",
    handle: "@henryhudson6",
    href: "https://x.com/henryhudson6",
    color: "text-foreground",
    glowClass: "",
    description: "The developer. DMs open.",
  },
];

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-xs tracking-widest text-accent/70 uppercase">
              Get in touch
            </p>
            <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
              Contact
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted max-w-2xl">
              Find us on X. Follow for updates, or send a DM.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {profiles.map((profile, i) => (
            <FadeIn key={profile.handle} delay={i * 0.1}>
              <a
                href={profile.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`card-glow ${profile.glowClass} block rounded-2xl border border-card-border bg-card-bg p-8 hover:border-card-border-hover transition-all group`}
              >
                <XIcon className="h-5 w-5 text-muted/50 group-hover:text-foreground transition-colors" />
                <h2 className={`mt-4 text-xl font-bold ${profile.color}`}>
                  {profile.label}
                </h2>
                <p className="mt-1 text-sm text-muted/50">{profile.handle}</p>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  {profile.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm text-muted/50 group-hover:text-foreground transition-colors">
                  Follow on X
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
              </a>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}
