// The TypeScript face of chain-put.mjs, for the src/lib tests and any future
// TypeScript caller. The runtime contract lives in the .mjs; keep the two in
// step when either changes.
import type { Transaction } from "@bsv/sdk";

export interface InscriptionSummary {
  tx: Transaction;
  fee: number;
  change: number;
  payloadBytes: number;
  sourceLabel: string;
  txid: string | null;
}

export declare function inscribeDocument(args: {
  wif: string;
  keyHex: string;
  surface: string;
  date: string;
  bytes: Uint8Array;
  previousTxid?: string;
  prevTx?: Transaction | null;
  feeCeiling?: number;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}): Promise<InscriptionSummary>;

export declare function changeOutputIndex(tx: Transaction): number;
export declare const FEE_RATE_SATS_PER_KB: number;
export declare const FEE_CEILING_SATS: number;
export declare const DRY_RUN_SOURCE_SATS: number;

export declare const BROADCAST_ENDPOINTS: string[];
export declare const BROADCAST_BACKOFF_MS: number[];
export declare function broadcastRaw(
  hex: string,
  opts?: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; log?: (message: string) => void },
): Promise<string>;
export declare function txidFromBroadcast(body: string): string | null;
