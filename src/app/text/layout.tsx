import type { ReactNode } from "react";

/**
 * Scopes the Henceforth three-colour identity — true black, white, one orange
 * accent — to every /text route. The `.textroom` class overrides the shared
 * design tokens (see globals.css), exactly as `.paper` does for /articles, so
 * every component below re-skins by reading the same Tailwind theme classes it
 * always has. A plain <div>, not a landmark: the root layout owns <main>.
 */
export default function TextLayout({ children }: { children: ReactNode }) {
  return <div className="textroom">{children}</div>;
}
