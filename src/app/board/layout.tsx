import type { ReactNode } from "react";

// Board paints its own light/dark morning-board theme (see BoardClient +
// morning-board.css). No forced .paper wrapper — the client sets data-theme
// and scopes all surfaces so light is the default parchment look and dark
// matches the local Superpowers board.
export default function BoardLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
