// Shared navigation lists for the content sections (Docs, Articles, Learn).
// Used by <SectionNav> on every content page, plus the chapter card list
// on /docs. Single source of truth so route additions only need editing
// here, not in multiple page files.

export type NavItem = {
  href: string;
  label: string;
  blurb?: string;
};

export const CONTENT_SECTIONS: NavItem[] = [
  { href: "/docs", label: "Docs" },
  { href: "/articles", label: "Articles" },
  { href: "/learn", label: "Learn" },
];

export const DOCS_CHAPTERS: NavItem[] = [
  {
    href: "/docs/about",
    label: "About",
    blurb: "Links to source code and support channels.",
  },
  {
    href: "/docs/goals",
    label: "Goals",
    blurb: "What Henceforth has achieved and what's coming next.",
  },
  {
    href: "/docs/credits",
    label: "Credits",
    blurb: "The people, books, and codebases that make Henceforth possible.",
  },
];
