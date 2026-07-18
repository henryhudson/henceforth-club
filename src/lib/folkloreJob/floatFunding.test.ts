import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import { FLOAT_KUDOS } from "@/lib/kudos/constants";
import { readProfileAccount } from "@/lib/kudos/float";
import { floatLegSats, issueFloatOnCompletion, profileForToken } from "./floatFunding";

/** A minimal in-memory stand-in for the Upstash client — only the calls the
 * funding path actually makes: `incrby`, `get`, and `set` with the `nx`
 * option, each atomic inside its call exactly as the real Redis is. */
function fakeRedis(): Redis {
  const store = new Map<string, unknown>();
  return {
    incrby: async (key: string, by: number) => {
      const next = ((store.get(key) as number | undefined) ?? 0) + by;
      store.set(key, next);
      return next;
    },
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown, opts?: { nx?: boolean }) => {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
  } as unknown as Redis;
}

/** A £2-era record: fee 1,000, no premium, an 18,000-satoshi float leg. */
const doneJob = {
  jobId: "job-1",
  handle: "Henry",
  feeSats: 1_000,
  premiumSats: 0,
  priceSats: 19_000,
};

/** A £1-era record: fee plus premium is the whole price — no float leg. */
const legacyJob = {
  jobId: "job-legacy",
  handle: "henry",
  feeSats: 500,
  premiumSats: 9_290_000,
  priceSats: 9_290_500,
};

describe("floatLegSats — the £2 leg derived from the untouched record schema", () => {
  it("is the price minus fee minus premium", () => {
    expect(floatLegSats(doneJob)).toBe(18_000);
  });

  it("is zero for a £1-era record, whose fee plus premium is the whole price", () => {
    expect(floatLegSats(legacyJob)).toBe(0);
  });

  it("is zero for corrupt or incomplete records rather than a negative or NaN leg", () => {
    expect(floatLegSats({ feeSats: Number.NaN, premiumSats: 0, priceSats: 1000 })).toBe(0);
    expect(floatLegSats({ feeSats: 2000, premiumSats: 0, priceSats: 1000 })).toBe(0);
  });
});

describe("issueFloatOnCompletion — the £2 leg lands as 2,000 kudos, exactly once", () => {
  it("funds the float with FLOAT_KUDOS, issues a bearer token, and records the token-to-profile binding", async () => {
    const redis = fakeRedis();
    const result = await issueFloatOnCompletion(doneJob, () => "token-abc", redis);

    expect(result).toEqual({ kind: "issued", token: "token-abc", kudos: FLOAT_KUDOS });
    expect(FLOAT_KUDOS).toBe(2000);
    expect(await readProfileAccount("henry", redis)).toEqual({
      funded: 2000,
      float: 2000,
      spent: 0,
    });
    expect(await (redis as Redis).get("kudos:token:token-abc")).toBe("henry");
  });

  it("issues exactly once: a second completion poll reports already-issued and credits nothing", async () => {
    const redis = fakeRedis();
    await issueFloatOnCompletion(doneJob, () => "token-abc", redis);
    const again = await issueFloatOnCompletion(doneJob, () => "token-later", redis);

    expect(again).toEqual({ kind: "already-issued" });
    expect(await readProfileAccount("henry", redis)).toEqual({
      funded: 2000,
      float: 2000,
      spent: 0,
    });
    expect(await (redis as Redis).get("kudos:token:token-later")).toBeNull();
  });

  it("two contending polls resolve to one issue — the claim is a single atomic set-if-absent", async () => {
    const redis = fakeRedis();
    const [a, b] = await Promise.all([
      issueFloatOnCompletion(doneJob, () => "token-a", redis),
      issueFloatOnCompletion(doneJob, () => "token-b", redis),
    ]);

    const kinds = [a.kind, b.kind].sort();
    expect(kinds).toEqual(["already-issued", "issued"]);
    expect(await readProfileAccount("henry", redis)).toEqual({
      funded: 2000,
      float: 2000,
      spent: 0,
    });
  });

  it("a £1-era record funds nothing — no float leg was ever paid for", async () => {
    const redis = fakeRedis();
    const result = await issueFloatOnCompletion(legacyJob, () => "token-abc", redis);

    expect(result).toEqual({ kind: "no-float-leg" });
    expect(await readProfileAccount("henry", redis)).toEqual({ funded: 0, float: 0, spent: 0 });
    expect(await (redis as Redis).get("kudos:token:token-abc")).toBeNull();
  });

  it("is null-Redis safe: unavailable, nothing issued", async () => {
    expect(await issueFloatOnCompletion(doneJob, () => "token-abc", null)).toEqual({
      kind: "unavailable",
    });
  });
});

describe("profileForToken — the bearer token resolved back to its profile", () => {
  it("resolves an issued token to the lowercased profile it funds", async () => {
    const redis = fakeRedis();
    await issueFloatOnCompletion(doneJob, () => "token-abc", redis);
    expect(await profileForToken("token-abc", redis)).toBe("henry");
  });

  it("is null for a token never issued", async () => {
    expect(await profileForToken("never-issued", fakeRedis())).toBeNull();
  });

  it("is null-Redis safe: null", async () => {
    expect(await profileForToken("token-abc", null)).toBeNull();
  });
});
