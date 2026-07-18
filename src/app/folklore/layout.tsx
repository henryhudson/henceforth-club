import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Scopes the Henceforth three-colour identity — true black, white, one orange
 * accent — to every /folklore route. The `.folkloreroom` class overrides the shared
 * design tokens (see globals.css). Club navbar/footer are hidden for these
 * routes (Navbar / SiteFooter), so Folklore is full-viewport; a fixed corner
 * link is the only exit back to the club.
 */
export default function FolkloreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="folkloreroom min-h-screen bg-background text-foreground">
      <Link
        href="/"
        className="fixed bottom-4 left-4 z-50 font-mono text-[11px] text-muted/50 transition-colors hover:text-accent"
      >
        henceforth.club
      </Link>
      {children}
    </div>
  );
}
