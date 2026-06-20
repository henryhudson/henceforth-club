import type { ReactNode } from "react";

// Light "paper" theme for the private board (login + board), matching
// /articles and /docs. The `.paper` class redefines the surface tokens
// (--background, --foreground, --card-bg, --card-border, --muted) in
// globals.css, so the board's token-based classes resolve to the parchment
// palette. The sticky nav lives in the root layout — outside this wrapper —
// so it keeps the dark glass, exactly like articles/docs.
export default function BoardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="paper min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
