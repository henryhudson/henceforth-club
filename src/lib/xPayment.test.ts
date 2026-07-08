import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIN_PAYMENT_SATS,
  X_ARCHIVE_REWARD_ADDRESS,
  isTxid,
  minPaymentSats,
  satsPaidTo,
  verifyPayment,
} from "./xPayment";

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

describe("minPaymentSats", () => {
  it("covers a capped call: 101 resources at $0.005 is $0.505, about 3.9M sats at $12.98/BSV", () => {
    const worstCaseUsd = 101 * 0.005;
    const satsNeededAtCurrentPrice = (worstCaseUsd / 12.975) * 1e8;
    expect(DEFAULT_MIN_PAYMENT_SATS).toBeGreaterThan(satsNeededAtCurrentPrice);
  });

  it("reads the environment and ignores nonsense", () => {
    expect(minPaymentSats({ X_ARCHIVE_MIN_PAYMENT_SATS: "9000000" })).toBe(9_000_000);
    expect(minPaymentSats({ X_ARCHIVE_MIN_PAYMENT_SATS: "0" })).toBe(DEFAULT_MIN_PAYMENT_SATS);
    expect(minPaymentSats({})).toBe(DEFAULT_MIN_PAYMENT_SATS);
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
