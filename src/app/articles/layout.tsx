import type { ReactNode } from "react";

// Scopes the cream "paper" theme to /articles/*. The .paper class on
// the wrapper overrides --background, --foreground, --card-bg,
// --card-border, --muted via globals.css, so every Tailwind theme
// class inside this subtree (bg-background, text-foreground, etc.)
// resolves to the parchment palette. Accent colours and terminal
// palette stay unchanged — code blocks remain dark green-on-black
// panels embedded in the cream surface, like screenshots in a
// printed paper.
export default function ArticlesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="paper min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
