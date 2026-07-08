import { beforeEach, describe, expect, it } from "vitest";
import { MARGIN, bsvUsd, isUsableRate, resetPriceCache, satsForUsd } from "./xPrice";
import { RESOURCES_TEXT_ONLY, RESOURCES_WITH_MEDIA } from "./xGate";
import { resourcesToUsd } from "./xSpend";

const rate = (r: unknown): typeof fetch =>
  (async () => ({ ok: true, json: async () => ({ rate: r }) })) as unknown as typeof fetch;

beforeEach(resetPriceCache);

describe("satsForUsd", () => {
  it("converts dollars to satoshis at the given rate, with margin", () => {
    // $1 at $10 a BSV is 0.1 BSV = 10,000,000 sats; with a 1.25 margin, 12,500,000.
    expect(satsForUsd(1, 10, 1.25)).toBe(12_500_000);
  });

  it("rounds up, so we never accept a satoshi less than cost", () => {
    expect(satsForUsd(0.005, 12.975, 1)).toBe(38_536); // 38,535.6… rounds up
  });

  it("demands infinity — that is, refuses — when the rate is nonsense", () => {
    expect(satsForUsd(1, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(satsForUsd(1, -5)).toBe(Number.POSITIVE_INFINITY);
    expect(satsForUsd(1, Number.NaN)).toBe(Number.POSITIVE_INFINITY);
  });
});

// THE INVARIANT. Henry's rule: profit at the moment of sale, in terms of the BSV
// price. Whatever the price, the floor must exceed what the call costs us. A flat
// floor obeyed this only at the price it was written at, and underpriced the media
// endpoint — which pages the timeline twice — by 36 cents a call.
describe("the floor always exceeds the cost, at any price", () => {
  const prices = [0.5, 1, 5, 12.975, 50, 500, 14_714];
  const endpoints: Array<[string, number]> = [
    ["/api/x/fetch (text)", RESOURCES_TEXT_ONLY],
    ["/api/x/archive (pages the timeline twice)", RESOURCES_WITH_MEDIA],
  ];

  for (const [name, resources] of endpoints) {
    for (const price of prices) {
      it(`${name} at BSV $${price}`, () => {
        const costUsd = resourcesToUsd(resources);
        const floorUsd = (satsForUsd(costUsd, price) / 1e8) * price;
        expect(floorUsd).toBeGreaterThan(costUsd);
      });
    }
  }

  it("charges the media endpoint about twice the text endpoint", () => {
    const t = satsForUsd(resourcesToUsd(RESOURCES_TEXT_ONLY), 12.975);
    const m = satsForUsd(resourcesToUsd(RESOURCES_WITH_MEDIA), 12.975);
    expect(m / t).toBeGreaterThan(1.9);
  });

  it("takes a margin over cost, not merely cost", () => {
    expect(MARGIN).toBeGreaterThan(1);
    const cost = resourcesToUsd(RESOURCES_TEXT_ONLY);
    const floorUsd = (satsForUsd(cost, 12.975) / 1e8) * 12.975;
    expect(floorUsd / cost).toBeCloseTo(MARGIN, 2);
  });
});

describe("isUsableRate", () => {
  it("accepts a positive finite number and nothing else", () => {
    expect(isUsableRate(12.975)).toBe(true);
    expect(isUsableRate(0)).toBe(false);
    expect(isUsableRate(-1)).toBe(false);
    expect(isUsableRate(Number.NaN)).toBe(false);
    expect(isUsableRate("12.975")).toBe(false);
    expect(isUsableRate(null)).toBe(false);
  });
});

describe("bsvUsd", () => {
  it("reads the rate", async () => {
    await expect(bsvUsd(rate(12.975))).resolves.toEqual({ ok: true, bsvUsd: 12.975 });
  });

  it("caches for a minute, so a busy endpoint does not hammer the feed", async () => {
    let calls = 0;
    const counting: typeof fetch = (async () => {
      calls += 1;
      return { ok: true, json: async () => ({ rate: 12 }) };
    }) as unknown as typeof fetch;
    await bsvUsd(counting, 1_000_000);
    await bsvUsd(counting, 1_030_000); // 30s later
    expect(calls).toBe(1);
    await bsvUsd(counting, 1_070_000); // 70s later
    expect(calls).toBe(2);
  });

  it("FAILS CLOSED when the feed is down — we would rather serve nobody than serve at a loss", async () => {
    const down: typeof fetch = (async () => ({ ok: false })) as unknown as typeof fetch;
    await expect(bsvUsd(down)).resolves.toEqual({ ok: false, reason: "price-unavailable" });
  });

  it("fails closed when the feed throws", async () => {
    const throws: typeof fetch = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
    await expect(bsvUsd(throws)).resolves.toEqual({ ok: false, reason: "price-unavailable" });
  });

  it("fails closed on a zero, negative, or non-numeric rate", async () => {
    await expect(bsvUsd(rate(0))).resolves.toEqual({ ok: false, reason: "price-unavailable" });
    await expect(bsvUsd(rate(-1))).resolves.toEqual({ ok: false, reason: "price-unavailable" });
    await expect(bsvUsd(rate("lots"))).resolves.toEqual({ ok: false, reason: "price-unavailable" });
  });
});
