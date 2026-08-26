"use client";

import { useState, type ReactNode } from "react";

interface Section {
  title: string;
  content: ReactNode;
}

/**
 * Accordion with CSS grid-rows open/close — no Motion.
 * Multiple sections can be open at once.
 */
export default function Accordion({
  sections,
  accentClass = "text-accent",
}: {
  sections: Section[];
  accentClass?: string;
}) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set([0]));

  const toggle = (i: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="divide-y divide-card-border/50 border-y border-card-border/50">
      {sections.map((section, i) => {
        const isOpen = openIndices.has(i);
        return (
          <div key={section.title}>
            <button
              type="button"
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between gap-4 py-5 text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 rounded-sm"
              aria-expanded={isOpen}
            >
              <span
                className={`text-lg sm:text-xl font-semibold transition-colors ${
                  isOpen ? accentClass : "text-foreground"
                } group-hover:${accentClass}`}
              >
                {section.title}
              </span>
              <span
                className={`h-6 w-6 flex items-center justify-center rounded-full border border-card-border text-muted accordion-chevron ${
                  isOpen ? `${accentClass} rotate-45` : ""
                }`}
                aria-hidden="true"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
            </button>
            {/* A collapsed panel is only visually collapsed: without inert its
                content stays in the accessibility tree and its links stay in the
                tab order. inert removes both; aria-hidden is belt and braces for
                readers that do not yet honour it. */}
            <div
              className={`grid accordion-panel ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
              inert={!isOpen}
              aria-hidden={!isOpen}
            >
              <div className="overflow-hidden">
                <div className="pb-6 pr-10 text-sm sm:text-base leading-relaxed text-muted space-y-4">
                  {section.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
