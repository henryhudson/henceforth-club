// The published revenue address — where a folklore stamp pays its ten-pence
// floor (specification, Decision 4). One string for the site and, by copy,
// for the app: scripts/xtext-worker/worker.mjs carried it first (its hard
// rule 1, set 2026-07-15 on Henry's direction: the canonical cold wallet),
// and that retired worker cannot import TypeScript at runtime, so the two
// copies are kept equal by hand and pinned to each other by this module's
// test rather than by an import.

/** Henry's cold revenue address. */
export const REVENUE_ADDRESS = "1GsP511T8e4VjxYdAGnMYdDd6sWxWybcMP";

/** One output of a transaction as the explorer's JSON reports it: value in
 * whole coins, and the addresses its locking script pays (empty for a data
 * output). */
export type TxOutput = { value: number; addresses: readonly string[] };

const SATS_PER_COIN = 100_000_000;

/** Pure. The satoshis `outputs` pay to `address`, summed over every output
 * that names it. A value that is not a finite number pays nothing — a floor
 * check must never be met by an unreadable amount. */
export function revenueSatsTo(address: string, outputs: readonly TxOutput[]): number {
  return outputs
    .filter((output) => output.addresses.includes(address))
    .reduce(
      (sum, output) =>
        sum + (Number.isFinite(output.value) ? Math.round(output.value * SATS_PER_COIN) : 0),
      0,
    );
}
