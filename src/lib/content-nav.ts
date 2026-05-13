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

// The docs live on a single page (/docs) with anchor sections. Sub-pills
// in <SectionNav> link to those anchors. Old per-chapter URLs (/docs/about,
// /docs/goals, /docs/credits) still resolve but aren't navigated to from
// any active nav.
export const DOCS_CHAPTERS: NavItem[] = [
  { href: "/docs#about", label: "About" },
  { href: "/docs#goals", label: "Goals" },
  { href: "/docs#reference", label: "Reference" },
  { href: "/docs#wallet", label: "Wallet" },
  { href: "/docs#credits", label: "Credits" },
];
