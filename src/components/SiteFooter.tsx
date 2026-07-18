"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteFooter() {
  const pathname = usePathname();

  if (pathname?.startsWith("/provenance")) return null;

  return (
    <footer className="border-t border-card-border/30">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-accent glow-cyan">
              henceforth<span className="text-muted">.club</span>
            </p>
            <p className="mt-2 text-xs text-muted/60">
              iOS apps for thinkers and players
            </p>
            <p className="mt-3 text-xs text-muted/40">
              <Link href="/about" className="transition-colors hover:text-foreground">
                About the stack
              </Link>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-8 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted/40">Apps</p>
              <Link href="/henceforth" className="text-muted/60 transition-colors hover:text-foreground">
                Henceforth
              </Link>
              <Link href="/dadeckofcards" className="text-muted/60 transition-colors hover:text-foreground">
                Deck of Cards
              </Link>
              <Link href="/hansard" className="text-muted/60 transition-colors hover:text-foreground">
                Hansard
              </Link>
              <Link href="/folklore" className="text-muted/60 transition-colors hover:text-foreground">
                Folklore
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted/40">Learn</p>
              <Link href="/learn" className="text-muted/60 transition-colors hover:text-foreground">
                Starting Henceforth
              </Link>
              <Link href="/docs" className="text-muted/60 transition-colors hover:text-foreground">
                Docs
              </Link>
              <Link href="/articles" className="text-muted/60 transition-colors hover:text-foreground">
                Articles
              </Link>
              <Link href="/hansard/this-week" className="text-muted/60 transition-colors hover:text-foreground">
                This Week in Parliament
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted/40">Legal</p>
              <Link href="/henceforth/privacy" className="text-muted/60 transition-colors hover:text-foreground">
                Henceforth privacy
              </Link>
              <Link href="/dadeckofcards/privacy" className="text-muted/60 transition-colors hover:text-foreground">
                Deck of Cards privacy
              </Link>
              <Link href="/hansard/privacy" className="text-muted/60 transition-colors hover:text-foreground">
                Hansard privacy
              </Link>
              <Link href="/contact" className="text-muted/60 transition-colors hover:text-foreground">
                Contact
              </Link>
            </div>
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
