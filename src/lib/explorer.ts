// Block-explorer link-outs. Board entries link to BananaBlocks, GorillaPool's
// protocol-aware explorer (spec Q4: links-out only — byte fetches stay on
// WhatsOnChain). The transaction-page path was verified live on 2026-07-19
// against the genesis coinbase transaction.

export const txExplorerUrl = (txid: string): string => `https://bananablocks.com/tx/${txid}`;
