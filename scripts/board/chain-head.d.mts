// The TypeScript face of chain-head.mjs. The runtime contract lives in the
// .mjs; keep the two in step when either changes.
import type { Transaction } from "@bsv/sdk";
import type { InscriptionSummary } from "./chain-put.mjs";

export declare const HEAD_SURFACE: string;

export declare function buildHeadPayload(surfaces: Record<string, string>): Buffer;

export declare function parseHeadPayload(bytes: Uint8Array): {
  v: 1;
  surfaces: Record<string, string>;
};

export declare function inscribeHead(args: {
  wif: string;
  keyHex: string;
  date: string;
  surfaces: Record<string, string>;
  previousHeadTxid?: string;
  prevTx?: Transaction | null;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}): Promise<InscriptionSummary>;
