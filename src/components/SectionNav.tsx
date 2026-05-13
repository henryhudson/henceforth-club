"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/content-nav";

type Props = {
  sections: NavItem[];
  subItems?: NavItem[];
};

export default function SectionNav({ sections, subItems }: Props) {
  const pathname = usePathname() ?? "";

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
                  ? "border-accent-warm bg-accent-warm-glow text-accent-warm"
                  : "border-card-border bg-card-bg/50 text-muted hover:border-accent-warm hover:text-foreground"
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
                    ? "border-accent-warm/60 bg-accent-warm-glow text-accent-warm"
                    : "border-card-border/40 bg-card-bg/30 text-muted/70 hover:border-accent-warm/60 hover:text-foreground"
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
