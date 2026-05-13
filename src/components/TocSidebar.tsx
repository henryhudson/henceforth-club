"use client";

import { useState } from "react";
import Link from "next/link";
import type { SectionAccent } from "./SectionNav";

export type TocItem = {
  id: string;
  label: string;
  children?: TocItem[];
};

type AccentClasses = {
  heading: string;
  link: string;
  focus: string;
};

const ACCENT_CLASSES: Record<SectionAccent, AccentClasses> = {
  warm: {
    heading: "text-accent-warm",
    link: "hover:text-accent-warm",
    focus: "focus:border-accent-warm",
  },
  cyan: {
    heading: "text-accent",
    link: "hover:text-accent",
    focus: "focus:border-accent",
  },
  green: {
    heading: "text-accent-green",
    link: "hover:text-accent-green",
    focus: "focus:border-accent-green",
  },
  neutral: {
    heading: "text-foreground",
    link: "hover:text-foreground",
    focus: "focus:border-foreground",
  },
};

type Props = {
  items: TocItem[];
  accent?: SectionAccent;
  heading?: string;
};

function itemMatches(item: TocItem, q: string): boolean {
  if (!q) return true;
  if (item.label.toLowerCase().includes(q)) return true;
  return item.children?.some((child) => itemMatches(child, q)) ?? false;
}

export default function TocSidebar({
  items,
  accent = "warm",
  heading = "On this page",
}: Props) {
  const [query, setQuery] = useState("");
  const q = query.toLowerCase().trim();
  const styles = ACCENT_CLASSES[accent];

  const visible = q ? items.filter((item) => itemMatches(item, q)) : items;

  return (
    <aside className="hidden lg:block lg:sticky lg:top-32 lg:self-start lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto lg:pr-4 lg:border-r lg:border-card-border/30 text-sm">
      <div className="mb-4">
        <input
          type="search"
          placeholder="Filter sections…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter table of contents"
          className={`w-full rounded border border-card-border/40 bg-card-bg/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted/50 outline-none transition-colors ${styles.focus}`}
        />
      </div>
      <h2
        className={`mb-3 text-[10px] font-bold uppercase tracking-[0.18em] ${styles.heading}`}
      >
        ▸ {heading}
      </h2>
      {visible.length === 0 ? (
        <p className="text-xs text-muted/60">No matches.</p>
      ) : (
        <ul className="space-y-1">
          {visible.map((item) => {
            const visibleChildren = q
              ? item.children?.filter((c) => itemMatches(c, q)) ?? []
              : item.children ?? [];
            return (
              <li key={item.id}>
                <Link
                  href={`#${item.id}`}
                  className={`block py-1 text-foreground/80 transition-colors ${styles.link}`}
                >
                  <span className="text-muted">{"// "}</span>
                  {item.label}
                </Link>
                {visibleChildren.length > 0 && (
                  <ul className="mt-1 ml-2 space-y-0.5 border-l border-card-border/30 pl-3 pb-1">
                    {visibleChildren.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`#${child.id}`}
                          className={`block py-0.5 text-xs text-muted/70 transition-colors ${styles.link}`}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
