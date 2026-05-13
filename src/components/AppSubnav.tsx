"use client";

import { usePathname } from "next/navigation";
import SectionNav, { type SectionAccent } from "./SectionNav";
import {
  HENCEFORTH_NAV,
  DADECKOFCARDS_NAV,
  HANSARD_NAV,
  type NavItem,
} from "@/lib/content-nav";

type SubnavConfig = { items: NavItem[]; accent: SectionAccent };

// Map pathname → which app section this URL belongs to. First-match
// wins. /docs, /articles, /learn are Henceforth content (no URL prefix
// for historical reasons) so they all resolve to the Henceforth subnav.
const ROUTES: Array<{ prefix: string; config: SubnavConfig }> = [
  { prefix: "/henceforth", config: { items: HENCEFORTH_NAV, accent: "warm" } },
  { prefix: "/docs", config: { items: HENCEFORTH_NAV, accent: "warm" } },
  { prefix: "/articles", config: { items: HENCEFORTH_NAV, accent: "warm" } },
  { prefix: "/learn", config: { items: HENCEFORTH_NAV, accent: "warm" } },
  { prefix: "/dadeckofcards", config: { items: DADECKOFCARDS_NAV, accent: "cyan" } },
  { prefix: "/hansard", config: { items: HANSARD_NAV, accent: "green" } },
];

export default function AppSubnav() {
  const pathname = usePathname() ?? "";
  const match = ROUTES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );

  if (!match) return null;

  return (
    <div className="sticky top-[57px] z-40 border-b border-card-border/30 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6 py-3">
        <SectionNav
          sections={match.config.items}
          accent={match.config.accent}
        />
      </div>
    </div>
  );
}
