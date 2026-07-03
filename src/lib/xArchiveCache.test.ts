import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Redis } from "@upstash/redis";
import {
  CHUNK_SIZE,
  chunkPosts,
  childrenMap,
  dedupePosts,
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
): (txid: string) => Promise<SocialArchive | null> {
  return async (txid: string) => archives[txid] ?? null;
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

  it("fails open with no Redis: still serves correct pages, re-stitching every call", async () => {
    mockGetXTxids.mockResolvedValue(["txA"]);
    const fetchTxArchive = vi.fn(fetchTxArchiveFrom({ txA: socialArchive("h", chainOf("1", "2")) }));

    const first = await getArchivePage("h", 0, 30, fetchTxArchive, null);
    const second = await getArchivePage("h", 0, 30, fetchTxArchive, null);

    expect(first?.posts.map((p) => p.id)).toEqual(["2", "1"]);
    expect(second?.posts.map((p) => p.id)).toEqual(["2", "1"]);
    expect(fetchTxArchive).toHaveBeenCalledTimes(2); // no cache without Redis
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
