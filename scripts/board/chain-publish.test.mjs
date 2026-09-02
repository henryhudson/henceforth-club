import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateKey } from "@bsv/sdk";
import { publishToChain, readLedger, writeLedger } from "./chain-publish.mjs";
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
