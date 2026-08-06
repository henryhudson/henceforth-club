import { beforeEach, describe, it, expect, vi } from "vitest";
import type { Redis } from "@upstash/redis";

// `current` stands in for the module-level cached client `getRedis()` would
// otherwise return — null by default, matching the real function when no
// Upstash env vars are set.
let current: Redis | null = null;
vi.mock("./redis", () => ({ getRedis: () => current }));

import { archiveDigest, getTxDigest, resolveTxDigest, setTxDigest } from "./xDigest";
import type { SocialArchive } from "@/app/folklore/onchain";

/** A minimal in-memory stand-in for the Upstash client — only the calls
 * xDigest actually makes. */
function fakeRedis(): Redis {
  const store = new Map<string, unknown>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: unknown) => {
      store.set(k, v);
      return "OK";
    },
  } as unknown as Redis;
}

const TXID = "a".repeat(64);

const ARCHIVE: SocialArchive = {
  source: "x",
  handle: "h",
  profile: {},
  posts: [{ id: "1", at: "", text: "photo", mediaHashes: ["2"] }],
};

beforeEach(() => {
  current = null;
});

describe("archiveDigest", () => {
  it("collects every post id, and media ids only for posts with inscribed media", () => {
    const digest = archiveDigest({
      source: "x",
      handle: "h",
      profile: {},
      posts: [
        { id: "1", at: "", text: "plain" },
        { id: "2", at: "", text: "photo", mediaHashes: ["0"] },
        { id: "3", at: "", text: "empty media list", mediaHashes: [] },
      ],
    });
    expect(digest.tweetIds).toEqual(["1", "2", "3"]);
    expect(digest.mediaPostIds).toEqual(["2"]);
  });

  it("digests an archive with no posts to empty sets", () => {
    const digest = archiveDigest({ source: "x", handle: "h", profile: {}, posts: [] });
    expect(digest).toEqual({ tweetIds: [], mediaPostIds: [] });
  });
});

describe("resolveTxDigest", () => {
  it("answers from the forever-cache without touching the chain", async () => {
    current = fakeRedis();
    await setTxDigest(TXID, archiveDigest(ARCHIVE));
    const fetchArchive = vi.fn();
    await expect(resolveTxDigest(TXID, fetchArchive)).resolves.toEqual(archiveDigest(ARCHIVE));
    expect(fetchArchive).not.toHaveBeenCalled();
  });

  it("derives on a miss, writes back, and never fetches that transaction again", async () => {
    current = fakeRedis();
    const fetchArchive = vi.fn(async () => ARCHIVE);
    await expect(resolveTxDigest(TXID, fetchArchive)).resolves.toEqual(archiveDigest(ARCHIVE));
    await expect(resolveTxDigest(TXID, fetchArchive)).resolves.toEqual(archiveDigest(ARCHIVE));
    expect(fetchArchive).toHaveBeenCalledTimes(1);
  });

  it("refuses a transaction that is no archive, and caches nothing for it", async () => {
    current = fakeRedis();
    const fetchArchive = vi.fn(async () => null);
    await expect(resolveTxDigest(TXID, fetchArchive)).resolves.toBeNull();
    await expect(getTxDigest(TXID)).resolves.toBeNull();
  });

  it("still derives from the chain when no store is configured", async () => {
    const fetchArchive = vi.fn(async () => ARCHIVE);
    await expect(resolveTxDigest(TXID, fetchArchive)).resolves.toEqual(archiveDigest(ARCHIVE));
  });
});
