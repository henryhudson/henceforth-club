/**
 * What an xtext archive costs, mirroring the app's ArchiveCostEstimator exactly.
 *
 * The user pays the miner fee AND the developer reward. Quoting the miner fee
 * alone understates the price threefold, and a price on a web page that the
 * wallet then contradicts is the one lie this site cannot afford: its whole
 * product is that you can check things for yourself.
 *
 * Swift is the source of truth. The fixture in FORTHapp pins the two together.
 */

export const P2PKH_INPUT_BYTES = 148;
export const P2PKH_OUTPUT_BYTES = 34;
export const TX_OVERHEAD_BYTES = 10;

/** OP_FALSE, OP_RETURN, the pushdata length prefix, and the data output's own bytes. */
export const OP_RETURN_FRAMING_BYTES = 12;

/** The reward is twice the miner fee, which scales punishingly on a large media archive. */
export const MAX_ARCHIVE_REWARD_SATS = 50_000;

/** The advertised rate, verified in production. */
export const DEFAULT_FEE_PER_KB = 100;

export type ArchiveCost = {
  totalTxBytes: number;
  minerFeeSats: number;
  rewardSats: number;
  totalSats: number;
};

const defaultComputeFee = (bytes: number, ratePerKb: number): number =>
  Math.ceil((bytes * ratePerKb) / 1000);

/**
 * One transaction: one input, the OP_RETURN payload, a reward output, a
 * change output, and tx overhead. Reward is twice the miner fee, capped.
 */
export function estimateSingleOpReturn(
  byteCount: number,
  feePerKb: number = DEFAULT_FEE_PER_KB,
  computeFee: (bytes: number, ratePerKb: number) => number = defaultComputeFee,
): ArchiveCost {
  if (byteCount <= 0) {
    return { totalTxBytes: 0, minerFeeSats: 0, rewardSats: 0, totalSats: 0 };
  }

  const totalTxBytes =
    P2PKH_INPUT_BYTES +
    byteCount +
    OP_RETURN_FRAMING_BYTES +
    P2PKH_OUTPUT_BYTES +
    P2PKH_OUTPUT_BYTES +
    TX_OVERHEAD_BYTES;
  const minerFeeSats = Math.max(1, computeFee(totalTxBytes, feePerKb));
  const rewardSats = Math.max(1, Math.min(2 * minerFeeSats, MAX_ARCHIVE_REWARD_SATS));
  const totalSats = minerFeeSats + rewardSats;

  return { totalTxBytes, minerFeeSats, rewardSats, totalSats };
}
