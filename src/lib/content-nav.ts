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
  { href: "/henceforth/privacy", label: "Privacy" },
];

export const DADECKOFCARDS_NAV: NavItem[] = [
  { href: "/dadeckofcards", label: "Deck of Cards" },
  { href: "/dadeckofcards/privacy", label: "Privacy" },
];

export const HANSARD_NAV: NavItem[] = [
  { href: "/hansard", label: "Hansard" },
  { href: "/hansard/this-week", label: "This Week in Parliament" },
  { href: "/hansard/privacy", label: "Privacy" },
];

// Hub cards on /docs — chapter landing, not in-page anchors.
export const DOCS_HUB: Array<{
  href: string;
  label: string;
  kicker: string;
  blurb: string;
}> = [
  {
    href: "/docs/about",
    label: "About",
    kicker: "Source",
    blurb: "Who builds Henceforth, how to run the project, and where to get support.",
  },
  {
    href: "/docs/goals",
    label: "Goals",
    kicker: "Roadmap",
    blurb: "What is shipped, what “get people coding” means, and what is still future work.",
  },
  {
    href: "/docs/reference",
    label: "Word reference",
    kicker: "FORTH · Script",
    blurb: "Stack words, networking, transaction builder, and 140+ Bitcoin Script opcodes.",
  },
  {
    href: "/docs/wallet",
    label: "Wallet",
    kicker: "Architecture",
    blurb: "Trust domains, UTXO sync, SPV headers, cold mode, and security model.",
  },
  {
    href: "/docs/credits",
    label: "Credits",
    kicker: "Lineage",
    blurb: "Brodie, BITSRFR, Bitcoin, and the SwiftBSV foundation.",
  },
];

// TOC for /docs/reference. Anchors must match <a id="..." /> markers
// inside docs/reference/content.mdx.
export const DOCS_REFERENCE_TOC = [
  { id: "reference", label: "Reference" },
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
  { id: "ref-script-exec", label: "Script Execution" },
  { id: "ref-opcodes", label: "OPCodes" },
];

// TOC for /docs/wallet.
export const DOCS_WALLET_TOC = [
  { id: "wallet", label: "Bitcoin Wallet" },
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
];

// Kept for any remaining imports of the old single-page TOC shape.
export const DOCS_CHAPTERS: NavItem[] = [
  { href: "/docs/about", label: "About" },
  { href: "/docs/goals", label: "Goals" },
  { href: "/docs/reference", label: "Reference" },
  { href: "/docs/wallet", label: "Wallet" },
  { href: "/docs/credits", label: "Credits" },
];

export const DOCS_TOC = [
  { id: "about", label: "About" },
  { id: "goals", label: "Goals" },
  {
    id: "reference",
    label: "Reference",
    children: DOCS_REFERENCE_TOC.filter((t) => t.id !== "reference"),
  },
  {
    id: "wallet",
    label: "Wallet",
    children: DOCS_WALLET_TOC.filter((t) => t.id !== "wallet"),
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
