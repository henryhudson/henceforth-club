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
  { href: "/hansard/this-week", label: "This Week in Parliament" },
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
// inside docs/content.mdx. Nested children render as indented sub-items.
export const DOCS_TOC = [
  { id: "about", label: "About" },
  { id: "goals", label: "Goals" },
  {
    id: "reference",
    label: "Reference",
    children: [
      { id: "ref-compile", label: "Compile Words" },
      { id: "ref-meta", label: "Meta Programming" },
      { id: "ref-arithmetic", label: "Arithmetic" },
      { id: "ref-double-cell", label: "Double-Cell Arithmetic" },
      { id: "ref-numeric-output", label: "Numeric Output" },
      { id: "ref-comparison", label: "Comparison" },
      { id: "ref-bitwise", label: "Bitwise" },
      { id: "ref-stack", label: "Stack Operators" },
      { id: "ref-return-stack", label: "Return Stack" },
      { id: "ref-decision", label: "Decision" },
      { id: "ref-loop", label: "Loop" },
      { id: "ref-base", label: "Base" },
      { id: "ref-popup", label: "Pop-up" },
      { id: "ref-constants", label: "Constants & Variables" },
      { id: "ref-terminal", label: "Terminal" },
      { id: "ref-other", label: "Other Words" },
      { id: "ref-data-conv", label: "Data Conversion" },
      { id: "ref-strings", label: "String Operations" },
      { id: "ref-networking", label: "Networking" },
      { id: "ref-tx-builder", label: "Transaction Builder" },
      { id: "ref-crypto", label: "Bitcoin Cryptography" },
      { id: "ref-bap", label: "BAP Identity" },
      { id: "ref-script-rec", label: "Script Recording" },
      { id: "ref-script-bridge", label: "Script Bridge" },
      { id: "ref-script-helpers", label: "Script Helpers" },
      { id: "ref-opcodes", label: "OPCodes" },
    ],
  },
  {
    id: "wallet",
    label: "Wallet",
    children: [
      { id: "wallet-architecture", label: "Architecture" },
      { id: "wallet-cards", label: "Wallet Cards" },
      { id: "wallet-transactions", label: "Transactions" },
      { id: "wallet-utxo-sync", label: "UTXO Sync" },
      { id: "wallet-recovery", label: "Recovery" },
      { id: "wallet-spv", label: "SPV" },
      { id: "wallet-cold-mode", label: "Cold Mode & Air-Gap" },
      { id: "wallet-data-mgmt", label: "Data Management" },
      { id: "wallet-utxos", label: "UTXOs & Balance" },
      { id: "wallet-api", label: "API Providers" },
      { id: "wallet-security", label: "Security" },
    ],
  },
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
