import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MARGIN,
  bsvUsd,
  gbpPerBsv,
  gbpPerUsd,
  isUsableRate,
  resetPriceCache,
  satsForUsd,
  satsToPounds,
} from "./xPrice";
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

describe("gbpPerUsd + satsToPounds + gbpPerBsv (the display rate that replaced the hardcoded 0.79)", () => {
  beforeEach(() => resetPriceCache());

  const ok = (body: unknown) =>
    ({ ok: true, json: async () => body }) as Response;

  it("reads the European Central Bank pound rate and caches it for an hour", async () => {
    const fetchFn = vi.fn(async () => ok({ rates: { GBP: 0.74 } }));
    const first = await gbpPerUsd(fetchFn as unknown as typeof fetch, 0);
    expect(first).toEqual({ ok: true, gbpPerUsd: 0.74 });
    const cached = await gbpPerUsd(fetchFn as unknown as typeof fetch, 59 * 60 * 1000);
    expect(cached).toEqual({ ok: true, gbpPerUsd: 0.74 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await gbpPerUsd(fetchFn as unknown as typeof fetch, 61 * 60 * 1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("fails closed on a bad response or an unusable rate — the pound figure is omitted, never wrong", async () => {
    const bad = vi.fn(async () => ({ ok: false }) as Response);
    expect(await gbpPerUsd(bad as unknown as typeof fetch, 0)).toEqual({ ok: false, reason: "rate-unavailable" });
    const junk = vi.fn(async () => ok({ rates: { GBP: -1 } }));
    expect(await gbpPerUsd(junk as unknown as typeof fetch, 0)).toEqual({ ok: false, reason: "rate-unavailable" });
  });

  it("satsToPounds converts through both rates", () => {
    // 1,000,000 sats at $40 per coin and £0.75 per dollar = 0.01 × 40 × 0.75 = £0.30
    expect(satsToPounds(1_000_000, 40, 0.75)).toBeCloseTo(0.3);
    expect(satsToPounds(0, 40, 0.75)).toBe(0);
  });

  it("gbpPerBsv combines the two live rates, and is undefined when either is down", async () => {
    const both = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("frankfurter")
        ? ok({ rates: { GBP: 0.75 } })
        : ok({ rate: 40 }));
    expect(await gbpPerBsv(both as unknown as typeof fetch, 0)).toBeCloseTo(30);

    resetPriceCache();
    const gbpDown = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("frankfurter") ? (({ ok: false }) as Response) : ok({ rate: 40 }));
    expect(await gbpPerBsv(gbpDown as unknown as typeof fetch, 0)).toBeUndefined();
  });
});
