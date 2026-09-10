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
  /** The processor that accepted this transaction; null on a dry run. The next
   *  inscription of the chain passes it back as `preferEndpoint`. */
  endpoint: string | null;
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
  preferEndpoint?: string | null;
}): Promise<InscriptionSummary>;

export declare function changeOutputIndex(tx: unknown, address?: string | null): number;
export declare const FEE_RATE_SATS_PER_KB: number;
export declare const FEE_CEILING_SATS: number;
export declare const DRY_RUN_SOURCE_SATS: number;

export declare const BROADCAST_ENDPOINTS: string[];
export declare const BROADCAST_BACKOFF_MS: number[];
export declare function endpointOrder(prefer: string | null | undefined, endpoints?: string[]): string[];
export declare function broadcastRaw(
  hex: string,
  opts?: {
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    log?: (message: string) => void;
    preferEndpoint?: string | null;
  },
): Promise<{ txid: string; endpoint: string }>;
export declare function txidFromBroadcast(body: string): string | null;
export declare function fetchIndexer(
  path: string,
  opts?: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; log?: (message: string) => void },
): Promise<string>;
