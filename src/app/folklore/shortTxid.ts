/** The short form of a transaction id, everywhere one is shown. */
export function shortTxid(txid: string): string {
  return `${txid.slice(0, 6)}…${txid.slice(-4)}`;
}
