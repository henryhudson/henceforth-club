import type { ReactNode } from "react";

// Scopes the cream "paper" theme to the SwiftBSV book. `.paper` redefines
// the surface tokens in globals.css, flipping the TOC sidebar and MDX
// prose to the parchment palette. Mirrors articles/layout.tsx; code blocks
// stay dark green-on-black on both themes by design.
export default function SwiftBSVLayout({ children }: { children: ReactNode }) {
  return (
    <div className="paper min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
