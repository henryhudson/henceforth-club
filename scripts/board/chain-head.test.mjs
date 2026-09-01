import { describe, expect, it } from "vitest";
import { PrivateKey } from "@bsv/sdk";
import { buildHeadPayload, inscribeHead, parseHeadPayload } from "./chain-head.mjs";
import { inscribeDocument } from "./chain-put.mjs";

const WIF = PrivateKey.fromString("1".repeat(64), 16).toWif();
const KEY = "2".repeat(64);
const TXID_A = "a".repeat(64);
const quiet = () => {};

describe("the head payload", () => {
  it("round-trips a surface map", () => {
    const bytes = buildHeadPayload({ "board-latest": TXID_A });
    expect(parseHeadPayload(bytes)).toEqual({ v: 1, surfaces: { "board-latest": TXID_A } });
  });

  it("refuses an empty map — a head that names nothing is worse than no head", () => {
    expect(() => buildHeadPayload({})).toThrow(/at least one surface/);
  });

  it("refuses a bad surface slug and a bad transaction id", () => {
    expect(() => buildHeadPayload({ "Board:Latest": TXID_A })).toThrow(/lowercase slug/);
    expect(() => buildHeadPayload({ "board-latest": "not-a-txid" })).toThrow(/invalid transaction id/);
  });

  it("refuses a payload from a different version", () => {
    const bytes = Buffer.from(JSON.stringify({ v: 2, surfaces: { "board-latest": TXID_A } }));
    expect(() => parseHeadPayload(bytes)).toThrow(/version/);
  });
});

describe("inscribing the head", () => {
  it("spends the named document's change, so the chain enforces the order", async () => {
    const doc = await inscribeDocument({
      wif: WIF, keyHex: KEY, surface: "board-latest", date: "2026-09-01",
      bytes: Buffer.from(JSON.stringify({ cards: [] })), dryRun: true, log: quiet,
    });
    const head = await inscribeHead({
      wif: WIF, keyHex: KEY, date: "2026-09-01",
      surfaces: { "board-latest": doc.tx.id("hex") },
      prevTx: doc.tx, dryRun: true, log: quiet,
    });
    const input = head.tx.inputs[0];
    expect(input.sourceTransaction.id("hex")).toBe(doc.tx.id("hex"));
    expect(input.sourceTransaction.outputs[input.sourceOutputIndex].change).toBe(true);
  });

  it("chains to the previous head through the envelope", async () => {
    const doc = await inscribeDocument({
      wif: WIF, keyHex: KEY, surface: "board-latest", date: "2026-09-01",
      bytes: Buffer.from("{}"), dryRun: true, log: quiet,
    });
    const head = await inscribeHead({
      wif: WIF, keyHex: KEY, date: "2026-09-01",
      surfaces: { "board-latest": doc.tx.id("hex") },
      previousHeadTxid: TXID_A, prevTx: doc.tx, dryRun: true, log: quiet,
    });
    // The envelope's fifth push carries the previous head's id verbatim.
    expect(head.tx.toHex()).toContain(Buffer.from(TXID_A, "utf8").toString("hex"));
  });
});
