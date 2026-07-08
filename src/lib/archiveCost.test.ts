import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { estimateSingleOpReturn, MAX_ARCHIVE_REWARD_SATS } from "./archiveCost";

const FORTHAPP = "/Users/henryhudson/Programming/Main/FORTHapp";
const FIXTURE = `${FORTHAPP}/FORTH/Henceforth_Tests/Fixtures/archive-cost-fixture.json`;
const ESTIMATOR = `${FORTHAPP}/FORTH/FORTH/Bitcoin/Social Archive/ArchiveCostEstimator.swift`;
const CONSTANTS = `${FORTHAPP}/FORTH/FORTH/Helper /Extensions/ExtensionsForNumberFormatters.swift`;

describe("estimateSingleOpReturn", () => {
  it("charges nothing for nothing", () => {
    expect(estimateSingleOpReturn(0)).toEqual({
      totalTxBytes: 0, minerFeeSats: 0, rewardSats: 0, totalSats: 0,
    });
  });

  it("the user pays the miner fee AND the reward, not the miner fee alone", () => {
    const cost = estimateSingleOpReturn(208731);
    expect(cost.totalSats).toBe(cost.minerFeeSats + cost.rewardSats);
    expect(cost.totalSats).toBe(3 * cost.minerFeeSats);
  });

  it("caps the reward, so a large media archive cannot tip a quarter of a coin", () => {
    expect(estimateSingleOpReturn(543040).rewardSats).toBe(MAX_ARCHIVE_REWARD_SATS);
  });
});

// The parity gate. If Swift and TypeScript ever disagree about what an archive
// costs, the number on the web page is a lie about the number in the wallet.
const sibling = existsSync(FIXTURE);
if (!sibling) {
  console.warn(`\n  SKIPPING cost parity: ${FIXTURE} not found.\n  The Swift estimator is the source of truth; this check needs it.\n`);
}

type ParityFixture = {
  feePerKb: number;
  rows: Array<{
    byteCount: number;
    totalTxBytes: number;
    minerFeeSats: number;
    rewardSats: number;
    totalSats: number;
  }>;
};

// Read the fixture at module scope, guarded. A describe.skipIf callback body still
// runs at collection time — skipIf gates the tests inside, not the callback itself —
// so reading the file inside the describe body would crash with ENOENT on any machine
// without the sibling repository, rather than skipping. Reading here keeps the skip honest.
const fixture: ParityFixture = sibling
  ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as ParityFixture)
  : { feePerKb: 100, rows: [] };

describe.skipIf(!sibling)("parity with the app's Swift estimator", () => {
  it.each(fixture.rows)("reproduces the fixture row for $byteCount bytes", (row) => {
    expect(estimateSingleOpReturn(row.byteCount, fixture.feePerKb)).toEqual({
      totalTxBytes: row.totalTxBytes,
      minerFeeSats: row.minerFeeSats,
      rewardSats: row.rewardSats,
      totalSats: row.totalSats,
    });
  });

  it("uses the same byte constants the app uses", () => {
    const consts = readFileSync(CONSTANTS, "utf8");
    expect(consts).toContain("let p2pkhInputSize = 148");
    expect(consts).toContain("let p2pkhOutputSize = 34");
    expect(consts).toContain("let txOverheadSize = 10");
  });

  it("uses the same framing and reward cap the app uses", () => {
    const swift = readFileSync(ESTIMATOR, "utf8");
    expect(swift).toContain("opReturnFramingBytes = 12");
    expect(swift).toContain("maxArchiveRewardSats = 50_000");
  });
});
