import { describe, expect, it } from "vitest";
import {
  SATS_PER_RESOURCE,
  X_ARCHIVE_REWARD_ADDRESS,
  isTxid,
  minPaymentSatsFor,
  satsPaidTo,
  verifyPayment,
} from "./xPayment";
import { RESOURCES_TEXT_ONLY, RESOURCES_WITH_MEDIA } from "./xGate";
import { resourcesToUsd } from "./xSpend";

const OTHER = "1GsP511Tf1xEXAMPLEaddressNOTours";

const tx = (outs: Array<{ bsv: number; to?: string }>) => ({
  vout: outs.map((o) => ({
    value: o.bsv,
    scriptPubKey: o.to ? { addresses: [o.to] } : {},
  })),
});

describe("satsPaidTo", () => {
  it("sums only the outputs paying the reward address", () => {
    const t = tx([
      { bsv: 0.01, to: X_ARCHIVE_REWARD_ADDRESS },
      { bsv: 5, to: OTHER },
      { bsv: 0.04, to: X_ARCHIVE_REWARD_ADDRESS },
    ]);
    expect(satsPaidTo(t, X_ARCHIVE_REWARD_ADDRESS)).toBe(5_000_000);
  });

  it("ignores outputs with no address, such as an OP_RETURN", () => {
    expect(satsPaidTo(tx([{ bsv: 0 }, { bsv: 0.05, to: X_ARCHIVE_REWARD_ADDRESS }]), X_ARCHIVE_REWARD_ADDRESS))
      .toBe(5_000_000);
  });

  it("pays nothing when the transaction pays someone else", () => {
    expect(satsPaidTo(tx([{ bsv: 100, to: OTHER }]), X_ARCHIVE_REWARD_ADDRESS)).toBe(0);
  });

  it("rounds to whole satoshis rather than trusting floating point", () => {
    // 0.00000001 BSV is exactly one satoshi; 1e-8 * 1e8 is 0.9999999999999999 in IEEE 754.
    expect(satsPaidTo(tx([{ bsv: 0.00000001, to: X_ARCHIVE_REWARD_ADDRESS }]), X_ARCHIVE_REWARD_ADDRESS)).toBe(1);
  });

  it("survives a transaction with no outputs", () => {
    expect(satsPaidTo({}, X_ARCHIVE_REWARD_ADDRESS)).toBe(0);
  });
});

describe("isTxid", () => {
  it("accepts 64 hex characters, either case", () => {
    expect(isTxid("a".repeat(64))).toBe(true);
    expect(isTxid("A".repeat(64))).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isTxid("a".repeat(63))).toBe(false);
    expect(isTxid("g".repeat(64))).toBe(false);
    expect(isTxid("")).toBe(false);
    expect(isTxid(null)).toBe(false);
  });
});

const BSV_USD = 12.975; // the price SATS_PER_RESOURCE was pinned at

describe("minPaymentSatsFor", () => {
  // The invariant. Every endpoint must demand more than it will spend. A flat floor
  // charged /api/x/archive the same as /api/x/fetch, and archive pages the timeline
  // twice — so it lost 36 cents a call. This is the test that catches that.
  it.each([
    ["text-only endpoint", RESOURCES_TEXT_ONLY],
    ["media endpoint (pages the timeline twice)", RESOURCES_WITH_MEDIA],
  ])("%s: the payment floor exceeds what the call costs us", (_name, resources) => {
    const costUsd = resourcesToUsd(resources);
    const floorUsd = (minPaymentSatsFor(resources) / 1e8) * BSV_USD;
    expect(floorUsd).toBeGreaterThan(costUsd);
  });

  it("the media endpoint costs about twice the text endpoint, and is priced so", () => {
    const text = minPaymentSatsFor(RESOURCES_TEXT_ONLY);
    const media = minPaymentSatsFor(RESOURCES_WITH_MEDIA);
    expect(media / text).toBeGreaterThan(1.9);
  });

  it("scales linearly with resources, because X bills per resource", () => {
    expect(minPaymentSatsFor(2)).toBe(2 * SATS_PER_RESOURCE);
    expect(minPaymentSatsFor(200)).toBe(200 * SATS_PER_RESOURCE);
  });

  it("never asks for zero, even for a zero-resource call", () => {
    expect(minPaymentSatsFor(0)).toBe(1);
    expect(minPaymentSatsFor(-5)).toBe(1);
  });

  it("reads the environment and ignores nonsense", () => {
    expect(minPaymentSatsFor(1, { X_ARCHIVE_SATS_PER_RESOURCE: "60000" })).toBe(60_000);
    expect(minPaymentSatsFor(1, { X_ARCHIVE_SATS_PER_RESOURCE: "0" })).toBe(SATS_PER_RESOURCE);
    expect(minPaymentSatsFor(1, {})).toBe(SATS_PER_RESOURCE);
  });
});

describe("verifyPayment", () => {
  const ok = (t: unknown): typeof fetch =>
    (async () => ({ ok: true, json: async () => t })) as unknown as typeof fetch;
  const missing: typeof fetch = (async () => ({ ok: false })) as unknown as typeof fetch;
  const TXID = "b".repeat(64);

  it("accepts a transaction that pays enough", async () => {
    const t = tx([{ bsv: 0.06, to: X_ARCHIVE_REWARD_ADDRESS }]);
    await expect(verifyPayment(TXID, 5_000_000, ok(t))).resolves.toEqual({ ok: true, sats: 6_000_000 });
  });

  it("refuses a transaction that underpays by one satoshi", async () => {
    const t = tx([{ bsv: 0.04999999, to: X_ARCHIVE_REWARD_ADDRESS }]);
    await expect(verifyPayment(TXID, 5_000_000, ok(t))).resolves.toEqual({ ok: false, reason: "underpaid" });
  });

  it("refuses a transaction that pays a different address, however much", async () => {
    const t = tx([{ bsv: 1000, to: OTHER }]);
    await expect(verifyPayment(TXID, 5_000_000, ok(t))).resolves.toEqual({ ok: false, reason: "underpaid" });
  });

  it("refuses a malformed transaction id without touching the network", async () => {
    let called = false;
    const spy: typeof fetch = (async () => { called = true; return { ok: true, json: async () => ({}) }; }) as unknown as typeof fetch;
    await expect(verifyPayment("not-a-txid", 1, spy)).resolves.toEqual({ ok: false, reason: "bad-txid" });
    expect(called).toBe(false);
  });

  it("refuses a transaction that does not exist", async () => {
    await expect(verifyPayment(TXID, 1, missing)).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});
