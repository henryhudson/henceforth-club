import { describe, expect, it } from "vitest";
import { applyEvent, type JobEvent, type JobState, type TextJob } from "./jobs";

const NOW = 1_700_000_000_000;

function makeJob(overrides: Partial<TextJob> = {}): TextJob {
  return {
    jobId: "job-1",
    handle: "henry",
    contentHash: "hash",
    feeSats: 100,
    premiumSats: 9_290_000,
    priceSats: 9_290_100,
    state: "quoted",
    createdAtMs: NOW - 1_000,
    expiresAtMs: NOW + 900_000,
    ...overrides,
  };
}

describe("applyEvent — the named transition table", () => {
  it("quoted + key-published -> awaiting-payment, address recorded", () => {
    const job = makeJob({ state: "quoted" });
    const result = applyEvent(job, { kind: "key-published", address: "1Addr" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("awaiting-payment");
    expect(result.job.address).toBe("1Addr");
  });

  it("quoted + expired(residueSats === 0) -> swept, failureReason expired-before-key", () => {
    const job = makeJob({ state: "quoted" });
    const result = applyEvent(job, { kind: "expired", residueSats: 0 }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("swept");
    expect(result.job.failureReason).toBe("expired-before-key");
  });

  it("quoted + expired(residueSats > 0) -> sweeping", () => {
    // A quoted job has no published address, so nonzero residue should be
    // impossible — the machine stays total and routes by residue anyway.
    const job = makeJob({ state: "quoted" });
    const result = applyEvent(job, { kind: "expired", residueSats: 500 }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("sweeping");
  });

  it("awaiting-payment + payment-seen(>= price) -> funded, funding fields recorded", () => {
    const job = makeJob({ state: "awaiting-payment", address: "1Addr" });
    const event: JobEvent = { kind: "payment-seen", txid: "tx1", vout: 0, sats: job.priceSats, refundAddress: "1Refund" };
    const result = applyEvent(job, event, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("funded");
    expect(result.job.fundingTxid).toBe("tx1");
    expect(result.job.fundingVout).toBe(0);
    expect(result.job.fundingSats).toBe(job.priceSats);
    expect(result.job.payerRefundAddress).toBe("1Refund");
  });

  it("awaiting-payment + expired(residueSats > 0) -> sweeping", () => {
    const job = makeJob({ state: "awaiting-payment", address: "1Addr" });
    const result = applyEvent(job, { kind: "expired", residueSats: 500 }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("sweeping");
  });

  it("awaiting-payment + expired(residueSats === 0) -> swept", () => {
    const job = makeJob({ state: "awaiting-payment", address: "1Addr" });
    const result = applyEvent(job, { kind: "expired", residueSats: 0 }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("swept");
  });

  it("funded + inscribed -> inscribed, txid recorded", () => {
    const job = makeJob({
      state: "funded",
      address: "1Addr",
      fundingTxid: "tx1",
      fundingVout: 0,
      fundingSats: 9_290_100,
      payerRefundAddress: "1Refund",
    });
    const result = applyEvent(job, { kind: "inscribed", txid: "inscribetx" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("inscribed");
    expect(result.job.inscriptionTxid).toBe("inscribetx");
  });

  it("inscribed + registered -> done", () => {
    const job = makeJob({ state: "inscribed", inscriptionTxid: "inscribetx" });
    const result = applyEvent(job, { kind: "registered" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("done");
  });

  it("funded + broadcast-failed -> sweeping, reason recorded", () => {
    const job = makeJob({ state: "funded" });
    const result = applyEvent(job, { kind: "broadcast-failed", reason: "mempool-conflict" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("sweeping");
    expect(result.job.failureReason).toBe("mempool-conflict");
  });

  it("sweeping + sweep-broadcast -> sweeping, txid recorded", () => {
    const job = makeJob({ state: "sweeping" });
    const result = applyEvent(job, { kind: "sweep-broadcast", txid: "sweeptx" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("sweeping");
    expect(result.job.sweepTxid).toBe("sweeptx");
  });

  it("sweeping + sweep-confirmed -> swept", () => {
    const job = makeJob({ state: "sweeping", sweepTxid: "sweeptx" });
    const result = applyEvent(job, { kind: "sweep-confirmed" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("swept");
  });
});

describe("applyEvent — idempotent replay (crash-resume)", () => {
  it("replaying inscribed with the same transaction id on an inscribed job is ok and unchanged", () => {
    const job = makeJob({ state: "inscribed", inscriptionTxid: "inscribetx" });
    const result = applyEvent(job, { kind: "inscribed", txid: "inscribetx" }, NOW);
    expect(result).toEqual({ ok: true, job });
  });

  it("replaying inscribed with a different transaction id on an inscribed job is refused", () => {
    const job = makeJob({ state: "inscribed", inscriptionTxid: "inscribetx" });
    const result = applyEvent(job, { kind: "inscribed", txid: "other-tx" }, NOW);
    expect(result.ok).toBe(false);
  });

  it("replaying key-published with the same address on an awaiting-payment job is ok and unchanged", () => {
    const job = makeJob({ state: "awaiting-payment", address: "1Addr" });
    const result = applyEvent(job, { kind: "key-published", address: "1Addr" }, NOW);
    expect(result).toEqual({ ok: true, job });
  });

  it("replaying key-published with a different address on an awaiting-payment job is refused", () => {
    const job = makeJob({ state: "awaiting-payment", address: "1Addr" });
    const result = applyEvent(job, { kind: "key-published", address: "1Different" }, NOW);
    expect(result.ok).toBe(false);
  });

  it("replaying sweep-broadcast with the same transaction id on a sweeping job is ok and unchanged", () => {
    const job = makeJob({ state: "sweeping", sweepTxid: "sweeptx" });
    const result = applyEvent(job, { kind: "sweep-broadcast", txid: "sweeptx" }, NOW);
    expect(result).toEqual({ ok: true, job });
  });

  it("replaying sweep-broadcast with a different transaction id on a sweeping job is refused", () => {
    const job = makeJob({ state: "sweeping", sweepTxid: "sweeptx" });
    const result = applyEvent(job, { kind: "sweep-broadcast", txid: "other-tx" }, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("applyEvent — terminal states accept nothing", () => {
  const EVENTS: JobEvent[] = [
    { kind: "key-published", address: "1Addr" },
    { kind: "payment-seen", txid: "t", vout: 0, sats: 1, refundAddress: "1R" },
    { kind: "expired", residueSats: 0 },
    { kind: "inscribed", txid: "t" },
    { kind: "registered" },
    { kind: "broadcast-failed", reason: "x" },
    { kind: "sweep-broadcast", txid: "t" },
    { kind: "sweep-confirmed" },
    { kind: "inscription-found", txid: "t" },
  ];

  it.each(EVENTS)("done + $kind is refused", (event) => {
    const job = makeJob({ state: "done" });
    const result = applyEvent(job, event, NOW);
    expect(result.ok).toBe(false);
  });

  it.each(EVENTS)("swept + $kind is refused", (event) => {
    const job = makeJob({ state: "swept" });
    const result = applyEvent(job, event, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("applyEvent — total: every pair returns a value, never throws", () => {
  const ALL_STATES: JobState[] = [
    "quoted",
    "awaiting-payment",
    "funded",
    "inscribed",
    "done",
    "sweeping",
    "swept",
  ];
  const SAMPLE_EVENTS: JobEvent[] = [
    { kind: "key-published", address: "1Addr" },
    { kind: "payment-seen", txid: "t", vout: 0, sats: 1, refundAddress: "1R" },
    { kind: "expired", residueSats: 0 },
    { kind: "inscribed", txid: "t" },
    { kind: "registered" },
    { kind: "broadcast-failed", reason: "x" },
    { kind: "sweep-broadcast", txid: "t" },
    { kind: "sweep-confirmed" },
    { kind: "inscription-found", txid: "t" },
  ];

  it("every (state, event) pair returns an ok-or-refused result, never throws", () => {
    for (const state of ALL_STATES) {
      for (const event of SAMPLE_EVENTS) {
        const job = makeJob({ state });
        let result: ReturnType<typeof applyEvent> | undefined;
        expect(() => {
          result = applyEvent(job, event, NOW);
        }).not.toThrow();
        expect(typeof result?.ok).toBe("boolean");
      }
    }
  });
});

describe("the false-failure heal (money-path review F4, 2026-08-09)", () => {
  it("broadcast-failed records the attempted txid on the way into sweeping", () => {
    const job = makeJob({ state: "funded" });
    const result = applyEvent(job, { kind: "broadcast-failed", reason: "gorillapool: 503", attemptedTxid: "aa11" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("sweeping");
    expect(result.job.attemptedInscriptionTxid).toBe("aa11");
  });

  it("broadcast-failed without an attempted txid stores none (a build refusal has nothing to find)", () => {
    const job = makeJob({ state: "funded" });
    const result = applyEvent(job, { kind: "broadcast-failed", reason: "underfunded" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.attemptedInscriptionTxid).toBeUndefined();
  });

  it("sweeping + inscription-found with the recorded txid -> inscribed, failure reason cleared", () => {
    const job = makeJob({ state: "sweeping", attemptedInscriptionTxid: "aa11", failureReason: "gorillapool: 503" });
    const result = applyEvent(job, { kind: "inscription-found", txid: "aa11" }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.job.state).toBe("inscribed");
    expect(result.job.inscriptionTxid).toBe("aa11");
    expect(result.job.failureReason).toBeUndefined();
  });

  it("an arbitrary txid never resurrects a sweeping job", () => {
    const job = makeJob({ state: "sweeping", attemptedInscriptionTxid: "aa11" });
    const result = applyEvent(job, { kind: "inscription-found", txid: "bb22" }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.refused).toBe("txid-mismatch");
  });

  it("a sweeping job with NO recorded attempt refuses inscription-found", () => {
    const job = makeJob({ state: "sweeping" });
    const result = applyEvent(job, { kind: "inscription-found", txid: "aa11" }, NOW);
    expect(result.ok).toBe(false);
  });

  it("inscription-found refuses while a sweep is already broadcast — two live spends must resolve on the sweep rails", () => {
    const job = makeJob({ state: "sweeping", attemptedInscriptionTxid: "aa11", sweepTxid: "cc33" });
    const result = applyEvent(job, { kind: "inscription-found", txid: "aa11" }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.refused).toBe("sweep-in-flight");
  });

  it("inscription-found is refused outside sweeping", () => {
    for (const state of ["quoted", "awaiting-payment", "funded", "inscribed", "done", "swept"] as const) {
      const job = makeJob({ state, attemptedInscriptionTxid: "aa11" });
      const result = applyEvent(job, { kind: "inscription-found", txid: "aa11" }, NOW);
      expect(result.ok).toBe(false);
    }
  });
});
