import { TXID_RE } from "./linkRecord";

/** First 64 hex characters in `input`, lowercase, or null. */
const TXID_RUN = /[0-9a-fA-F]{64}/;

export function extractTargetTxid(input: string): string | null {
  const trimmed = input.trim();
  if (TXID_RE.test(trimmed)) return trimmed.toLowerCase();
  const run = trimmed.match(TXID_RUN);
  return run ? run[0].toLowerCase() : null;
}
