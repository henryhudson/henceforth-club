"use client";

import Link from "next/link";

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

/** Where the product stands with the App Store — a sum, because null did
 * double duty: "not released yet" (Apple chip saying coming soon) and "not a
 * store product at all" (a web product renders no chip). */
export type StoreStatus =
  | { kind: "download"; url: string }
  | { kind: "comingSoon" }
  | { kind: "web" };

export default function AppCard({
  title,
  tagline,
  description,
  href,
  store,
  accentClass,
  glowClass,
  badge,
}: {
  title: string;
  tagline: string;
  description: string;
  href: string;
  store: StoreStatus;
  accentClass: string;
  glowClass: string;
  badge: string;
}) {
  return (
    <div
      className={`group card-glow ${glowClass} relative flex flex-col rounded-2xl border border-card-border bg-card-bg p-8 sm:p-10 hover:border-card-border-hover h-full sm:aspect-[1/1.618]`}
    >
      {/* Full-card link sits behind interactive elements */}
      <Link
        href={href}
        className="absolute inset-0 rounded-2xl z-0"
        aria-label={`Learn more about ${title}`}
      />

      <div className="relative z-10 pointer-events-none flex items-center gap-3">
        <span className="text-xs px-2.5 py-1 rounded-full border border-card-border bg-background/50 text-muted">
          {badge}
        </span>
      </div>
      <h2
        className={`relative z-10 pointer-events-none mt-6 text-2xl sm:text-3xl font-bold ${accentClass}`}
      >
        {title}
      </h2>
      <p className="relative z-10 pointer-events-none mt-2 text-sm text-muted/70">
        {tagline}
      </p>
      <p className="relative z-10 pointer-events-none mt-6 text-sm leading-relaxed text-muted flex-1">
        {description}
      </p>
      <div className="relative z-10 mt-8 flex items-center justify-between gap-3">
        <span className="pointer-events-none flex items-center gap-2 text-sm text-muted/50 group-hover:text-foreground transition-colors">
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
        {store.kind === "download" ? (
          <a
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-background/50 px-3 py-1.5 text-xs text-muted hover:border-foreground/40 hover:text-foreground transition-all"
            aria-label={`Download ${title} on the App Store`}
          >
            <AppleIcon />
            Download
          </a>
        ) : store.kind === "comingSoon" ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-background/30 px-3 py-1.5 text-xs text-muted/40 cursor-default"
            aria-label={`${title} coming soon`}
          >
            <AppleIcon />
            Coming soon
          </span>
        ) : null}
      </div>
    </div>
  );
}
