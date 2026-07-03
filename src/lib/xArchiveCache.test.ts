import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Redis } from "@upstash/redis";
import {
  CHUNK_SIZE,
  chunkPosts,
  childrenMap,
  countPhotos,
  dedupePosts,
  earliestKnownTime,
  getArchivePage,
  getArchivePost,
  slicePage,
  txidSetHash,
} from "./xArchiveCache";
import type { XPost } from "@/app/x/parseArchive";
import type { SocialArchive } from "@/app/x/onchain";
import { getXTxids } from "./xIndex";

vi.mock("./xIndex", () => ({ getXTxids: vi.fn() }));
const mockGetXTxids = vi.mocked(getXTxids);

function post(id: string, overrides: Partial<XPost> = {}): XPost {
  return { id, at: "2020-01-01", text: `post ${id}`, ...overrides };
}

describe("chunkPosts", () => {
  it("groups posts into fixed-size chunks, chunk n holding [n*SIZE, (n+1)*SIZE)", () => {
    const posts = Array.from({ length: 250 }, (_, i) => post(String(i)));
    const chunks = chunkPosts(posts);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(CHUNK_SIZE);
    expect(chunks[1]).toHaveLength(CHUNK_SIZE);
    expect(chunks[2]).toHaveLength(50);
    expect(chunks[0][0].id).toBe("0");
    expect(chunks[1][0].id).toBe(String(CHUNK_SIZE));
  });

  it("returns no chunks for an empty archive", () => {
    expect(chunkPosts([])).toEqual([]);
  });

  it("returns exactly one chunk when the post count is an exact multiple of the chunk size", () => {
    const posts = Array.from({ length: CHUNK_SIZE }, (_, i) => post(String(i)));
    expect(chunkPosts(posts)).toHaveLength(1);
  });
});

describe("txidSetHash", () => {
  it("is stable for the same ordered list", () => {
    expect(txidSetHash(["a", "b", "c"])).toBe(txidSetHash(["a", "b", "c"]));
  });

  it("is order-sensitive", () => {
    expect(txidSetHash(["a", "b"])).not.toBe(txidSetHash(["b", "a"]));
  });

  it("changes when a new txid is appended (a delta extends the archive)", () => {
    const before = txidSetHash(["a", "b"]);
    const after = txidSetHash(["a", "b", "c"]);
    expect(after).not.toBe(before);
  });

  it("differs for a distinct set of ids", () => {
    expect(txidSetHash(["a"])).not.toBe(txidSetHash(["b"]));
  });
});

describe("childrenMap", () => {
  it("groups reply ids under the post they replied to", () => {
    const posts = [
      post("1"),
      post("2", { replyToId: "1" }),
      post("3", { replyToId: "1" }),
      post("4", { replyToId: "2" }),
    ];
    expect(childrenMap(posts)).toEqual({
      "1": ["2", "3"],
      "2": ["4"],
    });
  });

  it("ignores posts with no replyToId", () => {
    expect(childrenMap([post("1"), post("2")])).toEqual({});
  });

  it("maps an empty post list to an empty object", () => {
    expect(childrenMap([])).toEqual({});
  });
});

describe("dedupePosts", () => {
  it("drops a later duplicate, keeping the first (newest, since input is newest-first) occurrence", () => {
    const first = post("2", { text: "same text" });
    const dup = post("1", { text: "same text" });
    expect(dedupePosts([first, dup])).toEqual([first]);
  });

  it("compares trimmed text, so surrounding whitespace still counts as a duplicate", () => {
    const first = post("2", { text: "hello" });
    const dup = post("1", { text: "  hello  " });
    expect(dedupePosts([first, dup])).toEqual([first]);
  });

  it("keeps distinct posts in their original order", () => {
    const a = post("1", { text: "a" });
    const b = post("2", { text: "b" });
    expect(dedupePosts([a, b])).toEqual([a, b]);
  });
});

describe("countPhotos", () => {
  it("counts photo-type media across posts, ignoring other media types", () => {
    const posts = [
      post("1", {
        media: [
          { type: "photo", url: "a" },
          { type: "video", url: "b" },
        ],
      }),
      post("2", { media: [{ type: "photo", url: "c" }] }),
      post("3"),
    ];
    expect(countPhotos(posts)).toBe(2);
  });

  it("returns zero for an empty post list or one with no media", () => {
    expect(countPhotos([])).toBe(0);
    expect(countPhotos([post("1")])).toBe(0);
  });
});

describe("earliestKnownTime", () => {
  it("returns the smallest of the known times", () => {
    expect(earliestKnownTime({ a: 500, b: 1000, c: 200 })).toBe(200);
  });

  it("returns undefined when no times are known", () => {
    expect(earliestKnownTime({})).toBeUndefined();
  });
});

describe("slicePage", () => {
  it("returns the requested window when it fits inside the total", () => {
    expect(slicePage(100, 30, 30)).toEqual({ start: 30, end: 60 });
  });

  it("clamps the end to the total when the window runs past it", () => {
    expect(slicePage(100, 90, 30)).toEqual({ start: 90, end: 100 });
  });

  it("returns an empty range when the offset is already past the end", () => {
    expect(slicePage(100, 150, 30)).toEqual({ start: 100, end: 100 });
  });

  it("clamps a negative offset to zero", () => {
    expect(slicePage(100, -10, 30)).toEqual({ start: 0, end: 30 });
  });

  it("returns an empty range for a zero-length archive", () => {
    expect(slicePage(0, 0, 30)).toEqual({ start: 0, end: 0 });
  });

  it("returns an empty range for a zero limit", () => {
    expect(slicePage(100, 0, 0)).toEqual({ start: 0, end: 0 });
  });
});

/** A minimal in-memory stand-in for the Upstash client — only the two calls
 * xArchiveCache actually makes: `get` and `set`. */
function fakeRedis(): Redis {
  const store = new Map<string, unknown>();
  return {
    get: async <T,>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    set: async (key: string, value: unknown) => {
      store.set(key, value);
      return "OK";
    },
  } as unknown as Redis;
}

/** An on-chain archive containing the given (unsorted) posts under one txid. */
function socialArchive(handle: string, posts: SocialArchive["posts"]): SocialArchive {
  return { source: "x", handle, profile: { displayName: `${handle} display` }, posts };
}

function chainOf(...ids: string[]): SocialArchive["posts"] {
  return ids.map((id) => ({ id, at: "2020-01-01", text: `chain post ${id}` }));
}

function fetchTxArchiveFrom(
  archives: Record<string, SocialArchive | null>,
  times: Record<string, number> = {},
): (txid: string) => Promise<{ archive: SocialArchive; time?: number } | null> {
  return async (txid: string) => {
    const archive = archives[txid];
    return archive ? { archive, time: times[txid] } : null;
  };
}

/** A fetchTxArchive fake that counts how many times it was asked to do an
 * archive fetch versus a time lookup — standing in for the two separate
 * WhatsOnChain round trips `fetchTxArchiveWithTime` makes underneath. Used to
 * prove `includeTimes` actually skips the second round trip rather than just
 * discarding its result. */
function countingFetchTxArchive(
  archives: Record<string, SocialArchive | null>,
  times: Record<string, number> = {},
): {
  fetchTxArchive: (
    txid: string,
    fetchFn?: typeof fetch,
    includeTimes?: boolean,
  ) => Promise<{ archive: SocialArchive; time?: number } | null>;
  counts: { archive: number; time: number };
} {
  const counts = { archive: 0, time: 0 };
  const fetchTxArchive = async (txid: string, _fetchFn?: typeof fetch, includeTimes = true) => {
    counts.archive++;
    const archive = archives[txid];
    if (!archive) return null;
    if (includeTimes) counts.time++;
    return { archive, time: includeTimes ? times[txid] : undefined };
  };
  return { fetchTxArchive, counts };
}

beforeEach(() => {
  mockGetXTxids.mockReset();
});

describe("getArchivePage", () => {
  it("stitches, sorts newest-first, and caches on a fresh read", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom({
      txA: socialArchive("henry", chainOf("3", "1", "5", "2", "4")),
    });

    const page = await getArchivePage("henry", 0, 3, fetchTxArchive, redis);

    expect(page?.postCount).toBe(5);
    expect(page?.latestTxid).toBe("txA");
    expect(page?.profile.displayName).toBe("henry display");
    expect(page?.posts.map((p) => p.id)).toEqual(["5", "4", "3"]);
    // The chunk and meta keys were actually written.
    expect(await redis.get("x:posts:henry:meta")).not.toBeNull();
    expect(await redis.get("x:posts:henry:0")).not.toBeNull();
  });

  it("serves a second read from the cache without touching the chain again", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = vi.fn(fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1", "2")) }));

    await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    await getArchivePage("h", 0, 30, fetchTxArchive, redis);

    expect(fetchTxArchive).toHaveBeenCalledTimes(1);
  });

  it("re-stitches and rewrites the cache when a delta transaction extends the archive", async () => {
    const redis = fakeRedis();
    const fetchTxArchive = vi.fn(
      fetchTxArchiveFrom({
        txA: socialArchive("h", chainOf("1", "2")),
        txB: socialArchive("h", chainOf("3")),
      }),
    );

    mockGetXTxids.mockResolvedValueOnce(["txA"]);
    const first = await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    expect(first?.postCount).toBe(2);

    mockGetXTxids.mockResolvedValueOnce(["txA", "txB"]);
    const second = await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    expect(second?.postCount).toBe(3);
    expect(second?.posts.map((p) => p.id)).toEqual(["3", "2", "1"]);
    expect(fetchTxArchive).toHaveBeenCalledTimes(3); // 1 txid the first read, 2 the second (no partial re-fetch)
  });

  it("reads only the chunks a slice spans, across a chunk boundary", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const ids = Array.from({ length: 120 }, (_, i) => String(1000 + i)); // 1000..1119
    const fetchTxArchive = fetchTxArchiveFrom({ txA: socialArchive("h", chainOf(...ids)) });

    const page = await getArchivePage("h", 90, 40, fetchTxArchive, redis);

    // Newest-first: 1119 downto 1000. offset 90 => id 1029, 30 posts to the end.
    expect(page?.posts).toHaveLength(30);
    expect(page?.posts[0].id).toBe("1029");
    expect(page?.posts.at(-1)?.id).toBe("1000");
  });

  it("returns an empty page (with the true total) when the offset is past the end", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1", "2")) });

    const page = await getArchivePage("h", 50, 30, fetchTxArchive, redis);
    expect(page?.posts).toEqual([]);
    expect(page?.postCount).toBe(2);
  });

  it("falls back to the un-cached preview archive for a handle that isn't indexed", async () => {
    mockGetXTxids.mockResolvedValue([]);
    const redis = fakeRedis();

    const page = await getArchivePage("henryhudson6", 0, 5, fetchTxArchiveFrom({}), redis);

    expect(page).not.toBeNull();
    expect(page?.latestTxid).toBeNull();
    expect(await redis.get("x:posts:henryhudson6:meta")).toBeNull();
  });

  it("returns null for a handle with no on-chain archive and no preview", async () => {
    mockGetXTxids.mockResolvedValue([]);
    const page = await getArchivePage("totally-unknown", 0, 5, fetchTxArchiveFrom({}), fakeRedis());
    expect(page).toBeNull();
  });

  it("falls back to the preview when every indexed transaction fails to fetch", async () => {
    mockGetXTxids.mockResolvedValue(["txMissing"]);
    const page = await getArchivePage("henryhudson6", 0, 5, fetchTxArchiveFrom({}), fakeRedis());
    expect(page).not.toBeNull();
    expect(page?.latestTxid).toBeNull();
  });

  it("gives a preview page no transaction data — it was never inscribed", async () => {
    mockGetXTxids.mockResolvedValue([]);
    const page = await getArchivePage("henryhudson6", 0, 5, fetchTxArchiveFrom({}), fakeRedis());
    expect(page?.txCount).toBeUndefined();
    expect(page?.photoCount).toBeUndefined();
    expect(page?.firstInscribedAt).toBeUndefined();
    expect(page?.txTimes).toEqual({});
  });

  it("counts photos across the deduplicated posts into photoCount", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const withPhotos: SocialArchive["posts"] = [
      { id: "1", at: "2020-01-01", text: "one photo", mediaHashes: ["0"] },
      { id: "2", at: "2020-01-01", text: "two photos", mediaHashes: ["0", "1"] },
      { id: "3", at: "2020-01-01", text: "no photo" },
    ];
    const fetchTxArchive = fetchTxArchiveFrom({ txA: socialArchive("h", withPhotos) });

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    expect(page?.photoCount).toBe(3);
  });

  it("counts zero photos when the archive carries none", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1", "2")) });

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    expect(page?.photoCount).toBe(0);
  });

  it("records the transaction count and known times, deriving firstInscribedAt as the earliest", async () => {
    mockGetXTxids.mockResolvedValue(["txA", "txB"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom(
      { txA: socialArchive("h", chainOf("1")), txB: socialArchive("h", chainOf("2")) },
      { txA: 1000, txB: 500 },
    );

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    expect(page?.txCount).toBe(2);
    expect(page?.txTimes).toEqual({ txA: 1000, txB: 500 });
    expect(page?.firstInscribedAt).toBe(500);
  });

  it("reports a single-transaction archive's txCount as 1", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1")) }, { txA: 1000 });

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    expect(page?.txCount).toBe(1);
  });

  it("omits an unconfirmed transaction from txTimes instead of recording it as zero", async () => {
    mockGetXTxids.mockResolvedValue(["txA", "txB"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom(
      { txA: socialArchive("h", chainOf("1")), txB: socialArchive("h", chainOf("2")) },
      { txA: 1000 }, // txB has no known time
    );

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    expect(page?.txTimes).toEqual({ txA: 1000 });
    expect(page?.firstInscribedAt).toBe(1000);
  });

  it("leaves firstInscribedAt unknown when no transaction time is known at all", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1")) });

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, redis);
    expect(page?.firstInscribedAt).toBeUndefined();
    expect(page?.txTimes).toEqual({});
  });

  it("rebuilds when the cached meta predates the v2 format, even if the txid set hash matches", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = vi.fn(
      fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1", "2")) }, { txA: 1000 }),
    );

    // A v1 (version-less) meta left over from before this task — same hash,
    // stale shape.
    await redis.set("x:posts:h:meta", {
      txidSetHash: txidSetHash(["txA"]),
      postCount: 2,
      chunkCount: 1,
      profile: { handle: "h" },
      latestTxid: "txA",
      generatedAt: "2020-01-01T00:00:00.000Z",
    });

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, redis);

    expect(fetchTxArchive).toHaveBeenCalledTimes(1); // rebuilt, not served stale
    expect(page?.txCount).toBe(1);
    expect(page?.firstInscribedAt).toBe(1000);
  });

  it("fails open with no Redis: still serves correct pages, re-stitching every call", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const fetchTxArchive = vi.fn(fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1", "2")) }));

    const first = await getArchivePage("h", 0, 30, fetchTxArchive, null);
    const second = await getArchivePage("h", 0, 30, fetchTxArchive, null);

    expect(first?.posts.map((p) => p.id)).toEqual(["2", "1"]);
    expect(second?.posts.map((p) => p.id)).toEqual(["2", "1"]);
    expect(fetchTxArchive).toHaveBeenCalledTimes(2); // no cache without Redis
  });

  it("with no Redis to cache the result, skips the time lookups and performs only the archive fetch per transaction", async () => {
    mockGetXTxids.mockResolvedValue(["txA", "txB"]);
    const { fetchTxArchive, counts } = countingFetchTxArchive(
      { txA: socialArchive("h", chainOf("1")), txB: socialArchive("h", chainOf("2")) },
      { txA: 1000, txB: 2000 },
    );

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, null);

    expect(counts.archive).toBe(2); // one archive fetch per transaction, same as always
    expect(counts.time).toBe(0); // no time round trip when there's nowhere to cache it
    expect(page?.txTimes).toEqual({});
  });

  it("with Redis available, still performs the time lookups so they can be cached", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const { fetchTxArchive, counts } = countingFetchTxArchive(
      { txA: socialArchive("h", chainOf("1")) },
      { txA: 1000 },
    );

    const page = await getArchivePage("h", 0, 30, fetchTxArchive, redis);

    expect(counts.time).toBe(1);
    expect(page?.txTimes).toEqual({ txA: 1000 });
  });
});

describe("getArchivePost", () => {
  it("finds a post by id via the cached chunks", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1", "2", "3")) });
    await getArchivePage("h", 0, 30, fetchTxArchive, redis); // warm the cache

    const found = await getArchivePost("h", "2", fetchTxArchive, redis);
    expect(found?.text).toBe("chain post 2");
  });

  it("returns null for an id the archive doesn't contain", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const redis = fakeRedis();
    const fetchTxArchive = fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1")) });

    expect(await getArchivePost("h", "999", fetchTxArchive, redis)).toBeNull();
  });

  it("finds a post in the un-cached preview archive", async () => {
    mockGetXTxids.mockResolvedValue([]);
    const page = await getArchivePage("henryhudson6", 0, 1, fetchTxArchiveFrom({}), fakeRedis());
    const firstId = page?.posts[0]?.id;
    expect(firstId).toBeTruthy();

    const found = await getArchivePost("henryhudson6", firstId ?? "", fetchTxArchiveFrom({}), fakeRedis());
    expect(found?.id).toBe(firstId);
  });
});
