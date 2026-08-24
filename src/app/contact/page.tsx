import type { Metadata } from "next";
import Link from "next/link";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch — by email or on X.",
};

const profiles = [
  {
    label: "Henceforth",
    handle: "@henceforth_app",
    href: "https://x.com/henceforth_app",
    color: "text-accent-warm",
    glowClass: "",
    description: "App updates, FORTH tips, and Bitcoin.",
  },
  {
    label: "Deck of Cards",
    handle: "@cardsDeck",
    href: "https://x.com/cardsDeck",
    color: "text-accent",
    glowClass: "card-glow",
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

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-xs tracking-widest text-accent-club uppercase">
              Get in touch
            </p>
            <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
              Contact
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted max-w-2xl">
              Email for anything serious; find us on X for everything else.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FadeIn>
            <div className="card-glow card-glow-warm flex h-full flex-col rounded-2xl border border-card-border bg-card-bg p-8 transition-all hover:border-card-border-hover">
              <EmailIcon className="h-5 w-5 text-muted/50" />
              <h2 className="mt-4 text-xl font-bold text-accent-warm">
                Email
              </h2>
              <p className="mt-1 text-sm text-muted/50 break-all">
                henry@henceforth.club
              </p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">
                Direct contact for Henceforth,{" "}
                <Link
                  href="/scriptedsupply"
                  className="text-foreground/80 underline decoration-card-border underline-offset-2 hover:text-accent-warm"
                >
                  Scripted Supply
                </Link>
                , and anything that needs more than 280 characters.
              </p>
              <a
                href="mailto:henry@henceforth.club"
                className="mt-6 inline-flex items-center gap-2 text-sm text-muted/50 transition-colors hover:text-foreground"
              >
                Send an email
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
          </FadeIn>

          {profiles.map((profile, i) => (
            <FadeIn key={profile.handle} delay={(i + 1) * 0.1}>
              <a
                href={profile.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`card-glow ${profile.glowClass} block rounded-2xl border border-card-border bg-card-bg p-8 hover:border-card-border-hover transition-all group h-full`}
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
