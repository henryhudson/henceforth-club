import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import { estimateSingleOpReturn } from "@/lib/archiveCost";
import {
  PASS_POUNDS,
  encodeEndowment,
  endowmentRecord,
  purchaseMessage,
  quoteEndowedRepeat,
  quotePass,
  readPass,
  recordPassOnCompletion,
  redeemMessage,
} from "./pass";

/** A minimal in-memory stand-in for the Upstash client — only the calls the
 * pass path actually makes: `get` and `set` with the `nx` option, each atomic
 * inside its call exactly as the real Redis is. */
function fakeRedis(): Redis {
  const store = new Map<string, unknown>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
  } as unknown as Redis;
}

describe("the endowment record and its messages", () => {
  it("lowercases the handle everywhere, matching how the index keys it", () => {
    expect(endowmentRecord("Henry", "1Addr").handle).toBe("henry");
    expect(purchaseMessage("Henry")).toBe("folklore-endow:henry");
    expect(redeemMessage("Henry", "hash123")).toBe("folklore-endow-redeem:henry:hash123");
  });

  it("pins the redemption message to the exact content hash, so a captured signature only replays identical content", () => {
    expect(redeemMessage("henry", "aaa")).not.toBe(redeemMessage("henry", "bbb"));
  });

  it("tags the record so the worker's legacy folklore payload sniff can never route it as a board record", () => {
    const record = endowmentRecord("henry", "1Addr");
    expect(record.app).toBe("folklore-pass");
    expect(record.app).not.toBe("folklore");
  });

  it("encodes to the exact bytes that will be priced and inscribed", () => {
    const record = endowmentRecord("henry", "1Addr");
    expect(new TextDecoder().decode(encodeEndowment(record))).toBe(JSON.stringify(record));
  });
});

describe("quotePass — £3 at the live rate, on top of the record's inscription fee", () => {
  it("prices the £3 leg at the live rate as the premium, with the fee from the one shared estimator", () => {
    const quote = quotePass(100, 10);
    expect(quote).not.toBeNull();
    expect(quote?.premiumSats).toBe(30_000_000); // ceil(1e8 * 3 / 10)
    expect(quote?.feeSats).toBe(estimateSingleOpReturn(100).minerFeeSats);
    expect(quote?.floatSats).toBe(0); // no kudos leg — the £3 is revenue-shaped premium
    expect(quote?.priceSats).toBe((quote?.feeSats ?? 0) + 30_000_000);
    expect(PASS_POUNDS).toBe(3);
  });

  it("fails closed without a live rate — no quote from a stale or missing conversion", () => {
    expect(quotePass(100, undefined)).toBeNull();
    expect(quotePass(100, Number.NaN)).toBeNull();
    expect(quotePass(100, 0)).toBeNull();
    expect(quotePass(100, -5)).toBeNull();
  });

  it("fails closed when the £3 leg falls to dust", () => {
    expect(quotePass(100, 600_000)).toBeNull(); // ceil(3e8 / 6e5) = 500 sats <= dust
  });

  it("prices a corrupt byte count as zero bytes rather than an unrepresentable quote", () => {
    const quote = quotePass(Number.NaN, 10);
    expect(quote?.feeSats).toBe(0);
    expect(quote?.priceSats).toBe(30_000_000);
  });
});

describe("quoteEndowedRepeat — the redeemed repeat is priced at zero to the visitor", () => {
  it("charges nothing while recording the real fee the worker's float must fund", () => {
    const quote = quoteEndowedRepeat(1234);
    expect(quote.priceSats).toBe(0);
    expect(quote.premiumSats).toBe(0);
    expect(quote.floatSats).toBe(0);
    expect(quote.feeSats).toBe(estimateSingleOpReturn(1234).minerFeeSats);
    expect(quote.feeSats).toBeGreaterThan(0);
  });

  it("normalizes a corrupt byte count to zero bytes", () => {
    expect(quoteEndowedRepeat(Number.NaN)).toEqual({ feeSats: 0, floatSats: 0, premiumSats: 0, priceSats: 0 });
  });
});

const DONE_PASS_JOB = {
  jobId: "pass-job-1",
  kind: "pass" as const,
  handle: "Henry",
  priceSats: 30_000_100,
  inscriptionTxid: "endowtx",
};

describe("recordPassOnCompletion — the purchase lands as a recorded pass, exactly once", () => {
  it("records the pass under the lowercased handle with the purchase evidence", async () => {
    const redis = fakeRedis();
    const result = await recordPassOnCompletion(DONE_PASS_JOB, 1_700_000_000_000, redis);
    expect(result).toEqual({
      kind: "recorded",
      pass: {
        handle: "henry",
        jobId: "pass-job-1",
        inscriptionTxid: "endowtx",
        purchasedAtMs: 1_700_000_000_000,
        priceSats: 30_000_100,
      },
    });

    const read = await readPass("HENRY", redis);
    expect(read.kind).toBe("pass");
  });

  it("records exactly once: a second completion poll reports already-recorded and writes nothing", async () => {
    const redis = fakeRedis();
    await recordPassOnCompletion(DONE_PASS_JOB, 1, redis);
    const again = await recordPassOnCompletion({ ...DONE_PASS_JOB, priceSats: 999 }, 2, redis);
    expect(again).toEqual({ kind: "already-recorded" });

    const read = await readPass("henry", redis);
    expect(read.kind === "pass" && read.pass.priceSats).toBe(30_000_100); // the first write stands
  });

  it("refuses a job of any other kind — only a pass purchase can mint a pass", async () => {
    const redis = fakeRedis();
    expect(await recordPassOnCompletion({ ...DONE_PASS_JOB, kind: "archive" }, 1, redis)).toEqual({
      kind: "not-a-pass-job",
    });
    expect(await recordPassOnCompletion({ ...DONE_PASS_JOB, kind: undefined }, 1, redis)).toEqual({
      kind: "not-a-pass-job",
    });
    expect((await readPass("henry", redis)).kind).toBe("absent");
  });

  it("answers unavailable, never a throw, without a configured store", async () => {
    expect(await recordPassOnCompletion(DONE_PASS_JOB, 1, null)).toEqual({ kind: "unavailable" });
  });
});

describe("readPass — the three-way read every money gate uses", () => {
  it("distinguishes a genuine absence from an unreachable store", async () => {
    expect(await readPass("henry", fakeRedis())).toEqual({ kind: "absent" });
    expect(await readPass("henry", null)).toEqual({ kind: "unavailable" });
  });

  it("reads the pass back regardless of the handle's case", async () => {
    const redis = fakeRedis();
    await recordPassOnCompletion(DONE_PASS_JOB, 1, redis);
    for (const spelling of ["henry", "Henry", "HENRY"]) {
      expect((await readPass(spelling, redis)).kind).toBe("pass");
    }
  });
});
