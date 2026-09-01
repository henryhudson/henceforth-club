import { describe, expect, it } from "vitest";
import { OP, PrivateKey, Script, Transaction, Utils } from "@bsv/sdk";
import { DRY_RUN_SOURCE_SATS, FEE_CEILING_SATS, changeOutputIndex, inscribeDocument } from "./chain-put.mjs";
import { INSCRIPTION_MARKER, openPayload, parseEnvelope } from "./chain-put-core.mjs";

// A throwaway key for the dry run: deterministic, worthless, never funded.
const WIF = PrivateKey.fromString("1".repeat(64), 16).toWif();
const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const noNetwork = async () => { throw new Error("a dry run must not touch the network"); };

/** The pushes after OP_FALSE OP_RETURN, the way the serving side reads them:
 *  from a transaction parsed off the wire, where the library keeps everything
 *  after OP_RETURN as that chunk's data. An in-memory script keeps the pushes
 *  top-level instead, so round-trip through hex first, as production does. */
function envelopePushes(built) {
  const tx = Transaction.fromHex(built.toHex());
  for (const o of tx.outputs) {
    const [op0, op1] = o.lockingScript.chunks;
    if (op0?.op !== OP.OP_FALSE || op1?.op !== OP.OP_RETURN || !op1.data) continue;
    return Script.fromBinary(op1.data).chunks.map((c) => Buffer.from(c.data ?? []));
  }
  return null;
}

describe("inscribing a document, dry run", () => {
  it("builds a signed transaction carrying the envelope and a change output, and touches no network", async () => {
    const doc = Buffer.from("The Morning Edition, Sunday 30 August 2026 ".repeat(40));
    const out = await inscribeDocument({
      wif: WIF, keyHex: KEY, surface: "daily-edition", date: "2026-08-30", bytes: doc,
      dryRun: true, fetchImpl: noNetwork, log: () => {},
    });
    expect(out.txid).toBeNull();
    expect(out.tx.outputs).toHaveLength(2);
    expect(out.tx.outputs[0].satoshis).toBe(0);
    expect(changeOutputIndex(out.tx)).toBe(1);
    expect(out.change).toBeGreaterThan(0);
    expect(out.fee).toBeGreaterThan(0);
    expect(out.fee).toBeLessThanOrEqual(FEE_CEILING_SATS);
    expect(out.fee + out.change).toBe(DRY_RUN_SOURCE_SATS);

    const pushes = envelopePushes(out.tx);
    expect(pushes).toHaveLength(6);
    expect(Utils.toUTF8(Array.from(pushes[0]))).toBe(INSCRIPTION_MARKER);
    const env = parseEnvelope(pushes);
    expect(env.surface).toBe("daily-edition");
    expect(env.date).toBe("2026-08-30");
    expect(env.previousTxid).toBeNull();
    expect(Buffer.from(openPayload(env.sealed, KEY)).equals(doc)).toBe(true);
  });

  it("chains onto the previous transaction's change when given one", async () => {
    const first = await inscribeDocument({
      wif: WIF, keyHex: KEY, surface: "board", date: "2026-08-30", bytes: Buffer.from("one"),
      dryRun: true, fetchImpl: noNetwork, log: () => {},
    });
    const second = await inscribeDocument({
      wif: WIF, keyHex: KEY, surface: "board", date: "2026-08-30", bytes: Buffer.from("two"),
      previousTxid: "a".repeat(64), prevTx: first.tx, dryRun: true, fetchImpl: noNetwork, log: () => {},
    });
    expect(second.sourceLabel).toBe("previous transaction's change");
    expect(second.fee + second.change).toBe(first.change);
    expect(parseEnvelope(envelopePushes(second.tx)).previousTxid).toBe("a".repeat(64));
  });

  it("refuses a payload whose fee passes the ceiling", async () => {
    // Incompressible bytes so gzip cannot rescue it: 400 kilobytes at 100
    // satoshis per kilobyte is about 40,000 satoshis, past the 30,000 ceiling
    // but still inside the fake input, so change exists and the ceiling is
    // the guard that fires.
    const { randomBytes } = await import("node:crypto");
    await expect(inscribeDocument({
      wif: WIF, keyHex: KEY, surface: "board", date: "2026-08-30", bytes: randomBytes(400_000),
      dryRun: true, fetchImpl: noNetwork, log: () => {},
    })).rejects.toThrow(/exceeds the/);
  });

  it("refuses a payload whose fee would eat the whole input rather than signing a data-only transaction", async () => {
    // 1.2 megabytes prices past the whole fake input; the sdk deletes the
    // change output when it goes non-positive, and that is the transaction
    // this guard exists to refuse.
    const { randomBytes } = await import("node:crypto");
    await expect(inscribeDocument({
      wif: WIF, keyHex: KEY, surface: "board", date: "2026-08-30", bytes: randomBytes(1_200_000),
      dryRun: true, fetchImpl: noNetwork, log: () => {},
    })).rejects.toThrow(/only output would be data/);
  });
});
