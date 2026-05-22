import type { ReactNode } from "react";

// Scopes the cream "paper" theme to /docs/* — the reference page and the
// goals/about/credits chapters. `.paper` redefines the surface tokens
// (--background, --foreground, --card-bg, --card-border, --muted) in
// globals.css, so the TOC sidebar, section nav, and MDX prose all resolve
// to the parchment palette. Mirrors articles/layout.tsx; code blocks stay
// dark green-on-black on both themes by design.
export default function DocsSectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="paper min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
