// Henceforth Bitcoin Limited's cash ledger. The shape mirrors the columns of
// ~/Henceforth/ledger/transactions.csv exactly, so the store and the file the
// accountant reads cannot drift apart.

export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  account: string;
  amount: string; // signed decimal, two places — see money.ts
  description: string;
  category: string;
  source: string;
};

export type Period = {
  id: string; // "<start>_<end>"
  label: string;
  start: string; // inclusive, YYYY-MM-DD
  end: string; // inclusive, YYYY-MM-DD
};

export type Commit = {
  periodId: string;
  root: string;
  leaves: string[];
  transactionIds: string[]; // parallel to leaves
  count: number;
  txid: string;
  broadcastAt: string; // ISO 8601
  supersedes?: string; // the previous root, when amending
};

export const ACCOUNTS = [
  "HSBC (debit)",
  "HSBC (credit)",
  "NatWest",
  "Amex (credit)",
] as const;

export const CATEGORIES = [
  "Statutory filing fees",
  "Internet",
  "Website",
  "Software subscriptions",
  "Training",
  "Equipment",
  "Phone",
  "Tax payment",
  "App revenue",
  "Uncategorised",
] as const;
