import { describe, expect, it } from "vitest";
import type { Redis } from "@upstash/redis";
import { validateComment, validateLink } from "@/app/folklore/linkRecord";
import {
  addCommentToIndex,
  addLinkToBoard,
  boardTop,
  bumpBoardKudos,
  commentCount,
  commentTxids,
  readLinkRecord,
  indexSince,
  isBoardLink,
  LINK_SCORE_OFFSET,
  linkMember,
  profileMember,
  seedProfileOnBoard,
} from "./folkloreBoard";

const TXID_A = "a".repeat(64);
const TXID_B = "b".repeat(64);
const TXID_C = "c".repeat(64);

const LINK = validateLink("https://example.com/a", "A title", "henry");
if (!LINK) throw new Error("fixture link must validate");
const COMMENT = validateComment(TXID_A, "worth reading");
if (!COMMENT) throw new Error("fixture comment must validate");

type ZaddArg = { nx?: boolean } | { score: number; member: string };

/**
 * Redis's own sorted-set order: ascending by score, and — this is the part a
 * score-only fake cannot express — equal scores broken by comparing the
 * MEMBER strings bytewise. Members here are ASCII (hex txids, X handles), so
 * JavaScript's code-unit comparison is the byte comparison.
 *
 * The board's whole ordering defect lived in this tie-break: with every entry
 * at score zero, `profile:` (0x70) sorts after `link:` (0x6c) ascending, so
 * under `rev` — an exact reversal of this order, members included — every
 * profile card came out ahead of every link. A fake that tied by Map
 * insertion order reported the opposite and could never have caught it.
 */
const byScoreThenMember = (a: [string, number], b: [string, number]): number =>
  a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/** A minimal in-memory stand-in for the Upstash client — only the calls the
 * board path makes: the zset trio (`zadd`, `zincrby`, `zrange`), the comment
 * list pair (`rpush`, `lrange`, `llen`), and plain `get`/`set` for the
 * record cache. Mirrors the kudos tests' fake. */
function fakeRedis(): Redis {
  const kv = new Map<string, unknown>();
  const zsets = new Map<string, Map<string, number>>();
  const lists = new Map<string, string[]>();
  const zset = (key: string) => {
    const existing = zsets.get(key);
    if (existing) return existing;
    const fresh = new Map<string, number>();
    zsets.set(key, fresh);
    return fresh;
  };
  return {
    zadd: async (key: string, ...args: ZaddArg[]) => {
      const first = args[0];
      const opts = first && !("member" in first) ? (args.shift() as { nx?: boolean }) : {};
      const z = zset(key);
      let added = 0;
      for (const arg of args as { score: number; member: string }[]) {
        if (opts.nx && z.has(arg.member)) continue;
        if (!z.has(arg.member)) added += 1;
        z.set(arg.member, arg.score);
      }
      return added;
    },
    zincrby: async (key: string, by: number, member: string) => {
      const z = zset(key);
      const next = (z.get(member) ?? 0) + by;
      z.set(member, next);
      return next;
    },
    zscore: async (key: string, member: string) => zset(key).get(member) ?? null,
    zrange: async (
      key: string,
      min: number | string,
      max: number | string,
      opts: { byScore?: boolean; rev?: boolean; withScores?: boolean } = {},
    ) => {
      const entries = [...zset(key).entries()].sort(byScoreThenMember);
      if (opts.byScore) {
        const lo = min === "-inf" ? -Infinity : Number(min);
        const hi = max === "+inf" ? Infinity : Number(max);
        const rows = entries.filter(([, score]) => score >= lo && score <= hi);
        return opts.withScores ? rows.flat() : rows.map(([member]) => member);
      }
      // `rev` is an exact reversal of the ascending order — score AND member.
      const sorted = opts.rev ? entries.reverse() : entries;
      const stop = Number(max) === -1 ? undefined : Number(max) + 1;
      const rows = sorted.slice(Number(min), stop);
      return opts.withScores ? rows.flat() : rows.map(([member]) => member);
    },
    rpush: async (key: string, ...values: string[]) => {
      const list = lists.get(key) ?? [];
      list.push(...values);
      lists.set(key, list);
      return list.length;
    },
    lrange: async (key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    },
    llen: async (key: string) => (lists.get(key) ?? []).length,
    get: async (key: string) => kv.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      kv.set(key, value);
      return "OK";
    },
  } as unknown as Redis;
}

describe("board members", () => {
  it("encodes links by txid and profiles by lowercased handle", () => {
    expect(linkMember(TXID_A)).toBe(`link:${TXID_A}`);
    expect(profileMember("Henry")).toBe("profile:henry");
  });
});

describe("addLinkToBoard", () => {
  it("lands the entry-floor board score, caches the record, and stamps the log", async () => {
    const redis = fakeRedis();
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);

    expect(await boardTop(10, redis)).toEqual([
      { member: linkMember(TXID_A), score: LINK_SCORE_OFFSET },
    ]);
    expect(await readLinkRecord(TXID_A, redis)).toEqual({ kind: "record", record: LINK });
    expect((await indexSince(0, redis)).txids).toEqual([TXID_A]);
  });

  it("a txid-link ranks under the target, even when the stamp id is passed in", async () => {
    const redis = fakeRedis();
    const stamp = "d".repeat(64);
    const listed = validateLink(TXID_A, "On chain");
    if (!listed) throw new Error("expected record");
    await addLinkToBoard(stamp, listed, 1_000, redis);
    expect(await boardTop(10, redis)).toEqual([
      { member: linkMember(TXID_A), score: LINK_SCORE_OFFSET },
    ]);
    expect(await readLinkRecord(TXID_A, redis)).toEqual({ kind: "record", record: listed });
    expect(await isBoardLink(TXID_A, redis)).toBe(true);
    expect(await isBoardLink(stamp, redis)).toBe(false);
  });

  it("is retry-safe: a re-add never resets the kudos score or the log stamp", async () => {
    const redis = fakeRedis();
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);
    await bumpBoardKudos(linkMember(TXID_A), 5, redis);

    await addLinkToBoard(TXID_A, LINK, 9_000, redis);

    expect(await boardTop(10, redis)).toEqual([
      { member: linkMember(TXID_A), score: 5 + LINK_SCORE_OFFSET },
    ]);
    // The log keeps the FIRST insertion time — a client synced at 5000 must
    // not be handed the txid again as if it were news.
    expect((await indexSince(5_000, redis)).txids).toEqual([]);
  });
});

describe("indexSince", () => {
  it("returns only txids logged at or after since, oldest first", async () => {
    const redis = fakeRedis();
    await addLinkToBoard(TXID_B, LINK, 2_000, redis);
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);
    await addLinkToBoard(TXID_C, LINK, 3_000, redis);

    expect((await indexSince(0, redis)).txids).toEqual([TXID_A, TXID_B, TXID_C]);
    // Inclusive at the boundary: the watermark txid is re-delivered rather
    // than risk a gap — the client's set-union merge dedupes it.
    expect((await indexSince(2_000, redis)).txids).toEqual([TXID_B, TXID_C]);
    expect((await indexSince(3_001, redis)).txids).toEqual([]);
  });

  it("captures now BEFORE the log read", async () => {
    let t = 41_000;
    const clock = () => t;
    const redis = fakeRedis();
    const reading = redis.zrange.bind(redis);
    // The log read lands mid-tick: any txid indexed during the read carries
    // a score after the returned watermark, so the next sync re-delivers it.
    (redis as unknown as { zrange: typeof reading }).zrange = (...args) => {
      t = 99_000;
      return reading(...args);
    };

    const { now } = await indexSince(0, redis, clock);
    expect(now).toBe(41_000);
  });
});

describe("kudos on the board", () => {
  it("bumpBoardKudos increments the member score; boardTop orders by score", async () => {
    const redis = fakeRedis();
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);
    await addLinkToBoard(TXID_B, LINK, 2_000, redis);
    await bumpBoardKudos(profileMember("henry"), 3, redis);
    await bumpBoardKudos(linkMember(TXID_A), 7, redis);
    await bumpBoardKudos(linkMember(TXID_A), 5, redis);

    expect(await boardTop(10, redis)).toEqual([
      { member: linkMember(TXID_A), score: 12 + LINK_SCORE_OFFSET },
      { member: profileMember("henry"), score: 3 },
      { member: linkMember(TXID_B), score: LINK_SCORE_OFFSET },
    ]);
    expect(await boardTop(1, redis)).toEqual([
      { member: linkMember(TXID_A), score: 12 + LINK_SCORE_OFFSET },
    ]);
  });
});

describe("the entry floor — a paid link is never born beneath the directory", () => {
  /** The reported shape: a seeded directory of 120 handles, all unkudosed,
   * and one freshly-inscribed link. */
  async function seededBoard(redis: Redis, handles: number) {
    for (let i = 0; i < handles; i += 1) {
      await seedProfileOnBoard(`handle${String(i).padStart(3, "0")}`, 0, redis);
    }
  }

  it("puts a freshly-entered link at the top of a board of unkudosed profiles", async () => {
    const redis = fakeRedis();
    await seededBoard(redis, 120);
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);

    expect((await boardTop(1, redis))[0]).toEqual({
      member: linkMember(TXID_A),
      score: LINK_SCORE_OFFSET,
    });
  });

  it("keeps the link inside the rendered window — boardTop(100) over 120 handles", async () => {
    const redis = fakeRedis();
    await seededBoard(redis, 120);
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);

    const window = await boardTop(100, redis);
    expect(window.map((row) => row.member)).toContain(linkMember(TXID_A));
  });

  it("still ranks by kudos: a profile with more kudos than a link outranks it", async () => {
    const redis = fakeRedis();
    await seedProfileOnBoard("ada", 0, redis);
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);
    await bumpBoardKudos(profileMember("ada"), 1, redis);

    expect((await boardTop(2, redis)).map((row) => row.member)).toEqual([
      profileMember("ada"),
      linkMember(TXID_A),
    ]);
  });

  it("cannot tie: at equal kudos the link — which paid to be here — edges the profile", async () => {
    const redis = fakeRedis();
    await seedProfileOnBoard("ada", 0, redis);
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);
    await bumpBoardKudos(profileMember("ada"), 3, redis);
    await bumpBoardKudos(linkMember(TXID_A), 3, redis);

    expect((await boardTop(2, redis)).map((row) => row.member)).toEqual([
      linkMember(TXID_A),
      profileMember("ada"),
    ]);
  });

  it("holds the offset across kudos: a link's score stays a whole kudos above the floor", async () => {
    const redis = fakeRedis();
    await addLinkToBoard(TXID_A, LINK, 1_000, redis);
    await bumpBoardKudos(linkMember(TXID_A), 7, redis);

    expect(await boardTop(1, redis)).toEqual([
      { member: linkMember(TXID_A), score: 7 + LINK_SCORE_OFFSET },
    ]);
  });
});

describe("isBoardLink — the kudos bump's classifier", () => {
  it("answers true only for a txid ranking on the board as a link", async () => {
    const redis = fakeRedis();
    expect(await isBoardLink(TXID_A, redis)).toBe(false);

    await addLinkToBoard(TXID_A, LINK, 1_000, redis);
    expect(await isBoardLink(TXID_A, redis)).toBe(true);
    expect(await isBoardLink(TXID_B, redis)).toBe(false);
  });

  it("never mistakes a profile card for a link — the member encodings differ", async () => {
    const redis = fakeRedis();
    await bumpBoardKudos(profileMember("henry"), 3, redis);
    expect(await isBoardLink("henry", redis)).toBe(false);
  });
});

describe("seedProfileOnBoard — the one-time directory seed", () => {
  it("lands the profile card at the given score and reports it new", async () => {
    const redis = fakeRedis();
    expect(await seedProfileOnBoard("Henry", 42, redis)).toBe(true);
    expect(await boardTop(10, redis)).toEqual([{ member: profileMember("Henry"), score: 42 }]);
  });

  it("is idempotent: a re-seed never resets a standing score — live kudos included", async () => {
    const redis = fakeRedis();
    await seedProfileOnBoard("henry", 42, redis);
    await bumpBoardKudos(profileMember("henry"), 8, redis);

    expect(await seedProfileOnBoard("henry", 0, redis)).toBe(false);
    expect(await boardTop(10, redis)).toEqual([{ member: profileMember("henry"), score: 50 }]);
  });
});

describe("readLinkRecord — absence and outage are different answers", () => {
  it("reports absent for a txid the cache does not hold, with a live store", async () => {
    const redis = fakeRedis();
    expect(await readLinkRecord(TXID_A, redis)).toEqual({ kind: "absent" });
  });

  it("reports unavailable when there is no store to ask", async () => {
    // The distinction the callers relay: absent is a verdict on the txid,
    // unavailable is a verdict on us. Collapsing them told a client its
    // request was wrong when the truth was "ask again in a moment".
    expect(await readLinkRecord(TXID_A, null)).toEqual({ kind: "unavailable" });
  });
});

describe("comments", () => {
  it("preserves RPUSH order, counts match, and the log is stamped", async () => {
    const redis = fakeRedis();
    await addCommentToIndex(TXID_A, TXID_B, 1_000, redis);
    await addCommentToIndex(TXID_A, TXID_C, 2_000, redis);

    expect(await commentTxids(TXID_A, redis)).toEqual([TXID_B, TXID_C]);
    expect(await commentCount(TXID_A, redis)).toBe(2);
    expect((await indexSince(0, redis)).txids).toEqual([TXID_B, TXID_C]);
  });

  it("is retry-safe: re-adding the same comment neither duplicates the list nor moves the log", async () => {
    const redis = fakeRedis();
    await addCommentToIndex(TXID_A, TXID_B, 1_000, redis);
    await addCommentToIndex(TXID_A, TXID_B, 9_000, redis);

    expect(await commentTxids(TXID_A, redis)).toEqual([TXID_B]);
    expect(await commentCount(TXID_A, redis)).toBe(1);
    expect((await indexSince(5_000, redis)).txids).toEqual([]);
  });

  it("reads empty for a link nobody has commented on", async () => {
    const redis = fakeRedis();
    expect(await commentTxids(TXID_A, redis)).toEqual([]);
    expect(await commentCount(TXID_A, redis)).toBe(0);
  });
});

describe("null redis — every function is a safe no-op or empty", () => {
  it("writers report false or null and never throw", async () => {
    expect(await addLinkToBoard(TXID_A, LINK, 1_000, null)).toBe(false);
    expect(await addCommentToIndex(TXID_A, TXID_B, 1_000, null)).toBe(false);
    expect(await bumpBoardKudos(linkMember(TXID_A), 5, null)).toBeNull();
    expect(await seedProfileOnBoard("henry", 42, null)).toBe(false);
  });

  it("readers report empty and indexSince still carries the clock", async () => {
    expect(await boardTop(10, null)).toEqual([]);
    expect(await isBoardLink(TXID_A, null)).toBe(false);
    expect(await commentTxids(TXID_A, null)).toEqual([]);
    expect(await commentCount(TXID_A, null)).toBe(0);
    expect(await readLinkRecord(TXID_A, null)).toEqual({ kind: "unavailable" });
    expect(await indexSince(0, null, () => 41_000)).toEqual({ txids: [], now: 41_000 });
  });
});
