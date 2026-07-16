"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteFooter() {
  const pathname = usePathname();

  if (pathname?.startsWith("/provenance")) return null;

  return (
    <footer className="border-t border-card-border/30">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div>
            <p className="text-sm font-bold text-accent glow-cyan">
              henceforth<span className="text-muted">.club</span>
            </p>
            <p className="mt-2 text-xs text-muted/60">
              iOS apps for thinkers and players
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Link
              href="/henceforth"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Henceforth
            </Link>
            <Link
              href="/dadeckofcards"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Deck of Cards
            </Link>
            <Link
              href="/hansard"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Hansard
            </Link>
            <Link
              href="/folklore"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Folklore
            </Link>
            <Link
              href="/contact"
              className="text-muted/60 transition-colors hover:text-foreground"
            >
              Contact
            </Link>
          </div>
        </div>
        <div className="section-line mt-8" />
        <p className="mt-6 text-xs text-muted/40">
          &copy; {new Date().getFullYear()} Henceforth Bitcoin Limited. All rights reserved.
        </p>
        <p className="mt-3 text-[10px] text-muted/25">by Henry Hudson</p>
        <div className="mt-4 flex flex-col gap-1.5 text-[10px] text-muted/20">
          <p>Some say the old code still listens. Try the sequence the masters knew: up, up, down, down...</p>
          <p>Press the key beside 1 while holding control. A stack awaits.</p>
          <p>Not all paths are on the map. Say hello to the world and see what stacks up.</p>
        </div>
      </div>
    </footer>
  );
}
