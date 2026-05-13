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

export const DADECKOFCARDS_NAV: NavItem[] = [
  { href: "/dadeckofcards", label: "Deck of Cards" },
];

export const HANSARD_NAV: NavItem[] = [
  { href: "/hansard", label: "Hansard" },
];

// In-page anchor TOC for the long single-page docs at /docs. Used in the
// /docs page body, not in the global sub-header.
export const DOCS_CHAPTERS: NavItem[] = [
  { href: "/docs#about", label: "About" },
  { href: "/docs#goals", label: "Goals" },
  { href: "/docs#reference", label: "Reference" },
  { href: "/docs#wallet", label: "Wallet" },
  { href: "/docs#credits", label: "Credits" },
];

// TOC for the sidebar on /docs. Anchors must match <a id="..." /> markers
// inside docs/content.mdx.
export const DOCS_TOC = [
  { id: "about", label: "About" },
  { id: "goals", label: "Goals" },
  { id: "reference", label: "Reference" },
  { id: "wallet", label: "Wallet" },
  { id: "credits", label: "Credits" },
];

// TOC for the sidebar on /henceforth/swiftbsv. Anchors must match the
// <a id="..." /> markers inside swiftbsv/content.mdx.
export const SWIFTBSV_TOC = [
  { id: "about", label: "About" },
  { id: "goals", label: "Goals" },
  { id: "credits", label: "Credits" },
  { id: "cryptographic-primitives", label: "Cryptographic Primitives" },
  { id: "keys-and-addresses", label: "Keys and Addresses" },
  { id: "hd-wallets", label: "HD Wallets" },
  { id: "type42", label: "Type42" },
  { id: "signatures", label: "Signatures and ECIES" },
  { id: "scripts", label: "Scripts and Opcodes" },
  { id: "transactions", label: "Transactions and TxBuilder" },
  { id: "spv", label: "Simplified Payment Verification" },
  { id: "integration", label: "Integration" },
];
