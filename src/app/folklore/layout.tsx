import type { ReactNode } from "react";

/**
 * Scopes the Henceforth three-colour identity — true black, white, one orange
 * accent — to every /folklore route. The `.folkloreroom` class overrides the shared
 * design tokens (see globals.css), exactly as `.paper` does for /articles, so
 * every component below re-skins by reading the same Tailwind theme classes it
 * always has. A plain <div>, not a landmark: the root layout owns <main>.
 */
export default function FolkloreLayout({ children }: { children: ReactNode }) {
  return <div className="folkloreroom">{children}</div>;
}
