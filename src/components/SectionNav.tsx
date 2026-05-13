"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/content-nav";

export type SectionAccent = "warm" | "cyan" | "green" | "neutral";

const ACCENT_STYLES: Record<
  SectionAccent,
  { active: string; hover: string; subActive: string; subHover: string }
> = {
  warm: {
    active: "border-accent-warm bg-accent-warm-glow text-accent-warm",
    hover: "hover:border-accent-warm hover:text-accent-warm",
    subActive: "border-accent-warm/60 bg-accent-warm-glow text-accent-warm",
    subHover: "hover:border-accent-warm/60 hover:text-accent-warm",
  },
  cyan: {
    active: "border-accent bg-accent-glow text-accent",
    hover: "hover:border-accent hover:text-accent",
    subActive: "border-accent/60 bg-accent-glow text-accent",
    subHover: "hover:border-accent/60 hover:text-accent",
  },
  green: {
    active: "border-accent-green bg-accent-green-glow text-accent-green",
    hover: "hover:border-accent-green hover:text-accent-green",
    subActive: "border-accent-green/60 bg-accent-green-glow text-accent-green",
    subHover: "hover:border-accent-green/60 hover:text-accent-green",
  },
  neutral: {
    active: "border-foreground text-foreground",
    hover: "hover:border-foreground hover:text-foreground",
    subActive: "border-foreground/60 text-foreground",
    subHover: "hover:border-foreground/60 hover:text-foreground",
  },
};

type Props = {
  sections: NavItem[];
  subItems?: NavItem[];
  accent?: SectionAccent;
};

export default function SectionNav({
  sections,
  subItems,
  accent = "neutral",
}: Props) {
  const pathname = usePathname() ?? "";
  const styles = ACCENT_STYLES[accent];

  return (
    <nav aria-label="Section navigation" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => {
          const isActive =
            pathname === s.href || pathname.startsWith(s.href + "/");
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex items-center rounded-full border px-5 py-2 text-sm transition-all ${
                isActive
                  ? styles.active
                  : `border-card-border bg-card-bg/50 text-muted ${styles.hover}`
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
      {subItems && subItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {subItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center rounded-full border px-3.5 py-1 text-xs transition-all ${
                  isActive
                    ? styles.subActive
                    : `border-card-border/40 bg-card-bg/30 text-muted/70 ${styles.subHover}`
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
