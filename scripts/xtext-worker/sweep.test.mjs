import { describe, expect, it } from "vitest";
import { P2PKH, PrivateKey, Transaction } from "@bsv/sdk";
import { buildSweepTx } from "./sweep.mjs";

const jobKey = PrivateKey.fromRandom();
const refundAddress = PrivateKey.fromRandom().toAddress();
const feeRate = 100;

describe("buildSweepTx", () => {
  it("returns everything minus the miner fee to the refund address — one input, one output", async () => {
    const fundings = [{ txid: "44".repeat(32), vout: 0, sats: 1_000_000 }];
    const built = await buildSweepTx({ jobKey, fundings, refundAddress, feeRate });

    expect(built.ok).not.toBe(false);
    expect(built.txid).toMatch(/^[0-9a-f]{64}$/);

    const tx = Transaction.fromHex(built.hex);
    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
    expect(tx.outputs[0].lockingScript.toHex()).toBe(new P2PKH().lock(refundAddress).toHex());

    // The implied fee (input minus the single output) covers the real serialized
    // size at feeRate; the 108-byte unlock estimate is conservative, so the fee
    // paid is a hair above the floor, never below it.
    const sizeBytes = built.hex.length / 2;
    const impliedFee = 1_000_000 - tx.outputs[0].satoshis;
    expect(impliedFee).toBeGreaterThanOrEqual(Math.ceil((sizeBytes * feeRate) / 1000));
    expect(impliedFee).toBeLessThan(200); // sanity: tens of satoshis at 100 sat/kb, not a runaway
  });

  it("sweeps several small legs in one transaction, summing every unspent output", async () => {
    const fundings = [
      { txid: "aa".repeat(32), vout: 0, sats: 400_000 },
      { txid: "bb".repeat(32), vout: 1, sats: 350_000 },
      { txid: "cc".repeat(32), vout: 0, sats: 250_000 },
    ];
    const sum = fundings.reduce((total, f) => total + f.sats, 0);
    const built = await buildSweepTx({ jobKey, fundings, refundAddress, feeRate });

    expect(built.ok).not.toBe(false);
    const tx = Transaction.fromHex(built.hex);
    expect(tx.inputs).toHaveLength(3);
    expect(tx.outputs).toHaveLength(1);

    const impliedFee = sum - tx.outputs[0].satoshis;
    const sizeBytes = built.hex.length / 2;
    expect(impliedFee).toBeGreaterThanOrEqual(Math.ceil((sizeBytes * feeRate) / 1000));
    expect(tx.outputs[0].satoshis).toBe(sum - impliedFee);
  });

  it("refuses a dust-level residue rather than building an unbroadcastable transaction", async () => {
    const fundings = [{ txid: "44".repeat(32), vout: 0, sats: 500 }];
    const built = await buildSweepTx({ jobKey, fundings, refundAddress, feeRate });
    expect(built).toEqual({ ok: false, reason: "dust" });
  });

  it("is deterministic — the same inputs rebuild the same txid (idempotent replay on resume)", async () => {
    const fundings = [{ txid: "44".repeat(32), vout: 0, sats: 1_000_000 }];
    const first = await buildSweepTx({ jobKey, fundings, refundAddress, feeRate });
    const second = await buildSweepTx({ jobKey, fundings, refundAddress, feeRate });
    expect(second.txid).toBe(first.txid);
    expect(second.hex).toBe(first.hex);
  });

  it("is deterministic across leg order too — the unspent poll's ordering is not stable, the txid must be", async () => {
    const fundings = [
      { txid: "cc".repeat(32), vout: 1, sats: 250_000 },
      { txid: "aa".repeat(32), vout: 0, sats: 400_000 },
      { txid: "cc".repeat(32), vout: 0, sats: 100_000 },
      { txid: "bb".repeat(32), vout: 1, sats: 350_000 },
    ];
    const reversed = [...fundings].reverse();
    const first = await buildSweepTx({ jobKey, fundings, refundAddress, feeRate });
    const second = await buildSweepTx({ jobKey, fundings: reversed, refundAddress, feeRate });
    expect(second.txid).toBe(first.txid);
    expect(second.hex).toBe(first.hex);
  });
});
