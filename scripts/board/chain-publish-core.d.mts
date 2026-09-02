// The TypeScript face of chain-publish-core.mjs; the runtime contract lives
// in the .mjs. Keep the two in step when either changes.
export declare const BOARD_SURFACE: string;
export declare const DONE_SURFACE: string;
export declare const GARDENING_SURFACE: string;
export declare function reportSurface(date: string): string;
export declare function weekSurface(date: string): string;
export declare function editionSurface(kind: string, date: string): string;
export declare function backfillEntries(
  ledger: ChainLedger,
  pairs: { key: string; txid: unknown }[],
): { ledger: ChainLedger; added: string[]; skipped: string[]; invalid: string[] };
export declare function canonicalBytes(document: unknown): Buffer;
export declare function splitBoard<C extends { col?: string }>(board: { cards?: C[] } & Record<string, unknown>): {
  latest: { cards: C[] } & Record<string, unknown>;
  done: { cards: C[] };
};
export declare function digestOf(bytes: Uint8Array): string;

export interface ChainLedger {
  surfaces: Record<string, { txid: string; sha256: string; date: string }>;
  head: { txid: string; date: string } | null;
}
export declare const EMPTY_LEDGER: ChainLedger;
export declare function changedDocuments<T extends { surface: string; bytes: Uint8Array }>(
  documents: T[],
  ledger: ChainLedger,
): T[];
export declare function withInscription(
  ledger: ChainLedger,
  entry: { surface: string; txid: string; sha256: string; date: string },
): ChainLedger;
export declare function withHead(ledger: ChainLedger, head: { txid: string; date: string }): ChainLedger;
export declare function headSurfaces(ledger: ChainLedger): Record<string, string>;
