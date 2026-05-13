// Per-app local navigation. The global Navbar handles switching between
// apps + the landing page; these lists drive the <SectionNav> that
// appears inside each app section.

export type NavItem = {
  href: string;
  label: string;
  blurb?: string;
};

export const HENCEFORTH_NAV: NavItem[] = [
  { href: "/henceforth", label: "Henceforth" },
  { href: "/henceforth/swiftbsv", label: "SwiftBSV" },
  { href: "/docs", label: "Docs" },
  { href: "/articles", label: "Articles" },
  { href: "/learn", label: "Learn" },
];

// In-page anchor TOC for the long single-page docs at /docs.
export const DOCS_CHAPTERS: NavItem[] = [
  { href: "/docs#about", label: "About" },
  { href: "/docs#goals", label: "Goals" },
  { href: "/docs#reference", label: "Reference" },
  { href: "/docs#wallet", label: "Wallet" },
  { href: "/docs#credits", label: "Credits" },
];
