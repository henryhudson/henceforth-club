import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { P2PKH, PrivateKey, Transaction } from "@bsv/sdk";
import { headSourceFor, inscribeHeadFor, publishToChain, readLedger, recordInscription, writeLedger } from "./chain-publish.mjs";
import { EMPTY_LEDGER, canonicalBytes, withInscription } from "./chain-publish-core.mjs";

const WIF = PrivateKey.fromString("1".repeat(64), 16).toWif();
const KEY = "2".repeat(64);
const quiet = () => {};

let dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chain-publish-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const docs = () => [
  { surface: "board-latest", bytes: canonicalBytes({ cards: [{ id: "one" }] }) },
  { surface: "board-report-2026-09-01", bytes: canonicalBytes({ date: "2026-09-01" }) },
];

describe("the ledger on disk", () => {
  it("reads as empty when absent, and round-trips when written", async () => {
    const path = join(dir, "ledger.json");
    expect(await readLedger(path)).toEqual(EMPTY_LEDGER);
    const ledger = withInscription(EMPTY_LEDGER, { surface: "board-latest", txid: "a".repeat(64), sha256: "x", date: "2026-09-01" });
    await writeLedger(path, ledger);
    expect(await readLedger(path)).toEqual(ledger);
  });
});

describe("an edition joining the index", () => {
  it("is remembered, and the next head names it beside everything else", async () => {
    const path = join(dir, "ledger.json");
    const first = await publishToChain({
      documents: docs(), ledgerPath: path, wif: WIF, keyHex: KEY, date: "2026-09-01", dryRun: true, log: quiet,
    });
    await writeLedger(path, first.ledger);
    const pdf = Buffer.from("%PDF-1.4 an edition");
    await recordInscription({ ledgerPath: path, surface: "daily-edition-2026-09-01", txid: "c".repeat(64), bytes: pdf, date: "2026-09-01" });
    const head = await inscribeHeadFor({ ledgerPath: path, wif: WIF, keyHex: KEY, date: "2026-09-01", dryRun: true, log: quiet });
    expect(head.tx).toBeTruthy();
    const ledger = await readLedger(path);
    expect(Object.keys(ledger.surfaces).sort()).toEqual(["board-latest", "board-report-2026-09-01", "daily-edition-2026-09-01"]);
    expect(ledger.surfaces["daily-edition-2026-09-01"].txid).toBe("c".repeat(64));
    // A dry-run head does not move the ledger's head.
    expect(ledger.head).toEqual(first.ledger.head);
  });

  it("names the edition it follows even before the ledger holds it — a dry run prices the real head", async () => {
    const path = join(dir, "ledger.json");
    const head = await inscribeHeadFor({
      ledgerPath: path, wif: WIF, keyHex: KEY, date: "2026-09-01",
      also: { "daily-edition-2026-09-01": "c".repeat(64) }, dryRun: true, log: quiet,
    });
    expect(head.tx).toBeTruthy();
    expect(await readLedger(path)).toEqual(EMPTY_LEDGER);
  });
});

describe("publishing to the chain", () => {
  it("inscribes every new document chained in one run, then the head naming them all", async () => {
    const path = join(dir, "ledger.json");
    const { steps, ledger } = await publishToChain({
      documents: docs(), ledgerPath: path, wif: WIF, keyHex: KEY, date: "2026-09-01", dryRun: true, log: quiet,
    });
    expect(steps.map((s) => `${s.name}:${s.failed ? "failed" : "ok"}`)).toEqual([
      "chain:board-latest:ok", "chain:board-report-2026-09-01:ok", "chain:head:ok",
    ]);
    expect(Object.keys(ledger.surfaces).sort()).toEqual(["board-latest", "board-report-2026-09-01"]);
    expect(ledger.head?.txid).toMatch(/^[0-9a-f]{64}$/);
    // Dry runs never write the ledger.
    await expect(readFile(path, "utf8")).rejects.toThrow();
  });

  it("spends nothing when nothing changed", async () => {
    const path = join(dir, "ledger.json");
    const first = await publishToChain({
      documents: docs(), ledgerPath: path, wif: WIF, keyHex: KEY, date: "2026-09-01", dryRun: true, log: quiet,
    });
    await writeLedger(path, first.ledger);
    const second = await publishToChain({
      documents: docs(), ledgerPath: path, wif: WIF, keyHex: KEY, date: "2026-09-02", dryRun: true, log: quiet,
    });
    expect(second.steps).toEqual([]);
    expect(second.ledger).toEqual(first.ledger);
  });

  it("inscribes only the changed surface, and a head that still names the unchanged one", async () => {
    const path = join(dir, "ledger.json");
    const first = await publishToChain({
      documents: docs(), ledgerPath: path, wif: WIF, keyHex: KEY, date: "2026-09-01", dryRun: true, log: quiet,
    });
    await writeLedger(path, first.ledger);
    const changed = [
      { surface: "board-latest", bytes: canonicalBytes({ cards: [{ id: "one" }, { id: "two" }] }) },
      docs()[1],
    ];
    const second = await publishToChain({
      documents: changed, ledgerPath: path, wif: WIF, keyHex: KEY, date: "2026-09-02", dryRun: true, log: quiet,
    });
    expect(second.steps.map((s) => s.name)).toEqual(["chain:board-latest", "chain:head"]);
    expect(second.ledger.surfaces["board-latest"].txid).not.toBe(first.ledger.surfaces["board-latest"].txid);
    expect(second.ledger.surfaces["board-report-2026-09-01"]).toEqual(first.ledger.surfaces["board-report-2026-09-01"]);
    expect(second.ledger.head.txid).not.toBe(first.ledger.head.txid);
  });

  it("a refused inscription stops the run before the head, and says why", async () => {
    const path = join(dir, "ledger.json");
    const { steps, ledger } = await publishToChain({
      documents: docs(), ledgerPath: path, wif: WIF, keyHex: "not-a-key", date: "2026-09-01", dryRun: true, log: quiet,
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].name).toBe("chain:board-latest");
    expect(steps[0].failed).toBe(true);
    expect(steps[0].reason).toContain("the chain refused the inscription");
    expect(steps.some((s) => s.name === "chain:head")).toBe(false);
    expect(ledger).toEqual(EMPTY_LEDGER);
  });
});

describe("chaining from the head", () => {
  const address = PrivateKey.fromWif(WIF).toAddress();
  const headTx = () => {
    const tx = new Transaction();
    tx.addOutput({ lockingScript: new P2PKH().lock("1BitcoinEaterAddressDontSendf59kuE"), satoshis: 1 }); // the data output stands in
    tx.addOutput({ lockingScript: new P2PKH().lock(address), satoshis: 90_000 }); // the change home
    return tx;
  };

  it("returns the head's transaction when it pays the archive address, with no change flag to read", async () => {
    const head = headTx();
    const ledger = { ...EMPTY_LEDGER, head: { txid: head.id("hex"), date: "2026-09-02" } };
    const fetchImpl = async () => ({ ok: true, status: 200, text: async () => head.toHex() });
    const got = await headSourceFor({ ledger, wif: WIF, fetchImpl, log: quiet });
    expect(got?.id("hex")).toBe(head.id("hex"));
  });

  it("is null with no head, so the indexer scan runs as before", async () => {
    expect(await headSourceFor({ ledger: EMPTY_LEDGER, wif: WIF, fetchImpl: async () => { throw new Error("must not fetch"); }, log: quiet })).toBe(null);
  });

  it("is null, and says so, when the head cannot be parsed", async () => {
    const lines = [];
    const ledger = { ...EMPTY_LEDGER, head: { txid: "ab".repeat(32), date: "2026-09-02" } };
    const fetchImpl = async () => ({ ok: true, status: 200, text: async () => "not a transaction" });
    expect(await headSourceFor({ ledger, wif: WIF, fetchImpl, log: (m) => lines.push(m) })).toBe(null);
    expect(lines.join(" ")).toMatch(/scanning the indexer instead/);
  });

  it("is null when the head pays nothing back to the archive address", async () => {
    const tx = new Transaction();
    tx.addOutput({ lockingScript: new P2PKH().lock("1BitcoinEaterAddressDontSendf59kuE"), satoshis: 5 });
    const ledger = { ...EMPTY_LEDGER, head: { txid: tx.id("hex"), date: "2026-09-02" } };
    const fetchImpl = async () => ({ ok: true, status: 200, text: async () => tx.toHex() });
    expect(await headSourceFor({ ledger, wif: WIF, fetchImpl, log: quiet })).toBe(null);
  });
});
