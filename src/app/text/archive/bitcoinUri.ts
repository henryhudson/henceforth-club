// The BIP-21 payment uniform resource identifier a wallet scans to pay a
// quoted job. Pure: satoshis in, string out, no clock, no network. The
// amount is whole-bitcoin units — satoshis divided by one hundred million,
// trailing zeros trimmed — the shape a wallet's "scan to pay" expects, not
// the satoshi integer the rest of this pipeline prices in.

/** priceSats as a decimal bitcoin amount, trailing zeros (and a trailing
 * decimal point) trimmed. Exported so the amount can be shown as selectable
 * text beside the address — the same figure the uniform resource identifier
 * encodes, never a second computation of it. */
export function bitcoinAmount(priceSats: number): string {
  const bitcoin = priceSats / 100_000_000;
  return bitcoin.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

export function bitcoinUri(address: string, priceSats: number): string {
  return `bitcoin:${address}?amount=${bitcoinAmount(priceSats)}`;
}
