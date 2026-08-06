import { describe, expect, it } from "vitest";
import {
  consumableSinceId,
  newestTweetId,
  watermarkFromRead,
  type CompletedRead,
  type XWatermark,
} from "./xWatermark";
import type { ArchivedSets } from "./xArchived";

const post = (id: string, text = `post ${id}`) => ({ id, text });

const BINDING_ADDRESS = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
const bindingPost = (id: string) => ({
  id,
  text: `Verifying my Henceforth identity: ${BINDING_ADDRESS}`,
});

const read = (overrides: Partial<CompletedRead>): CompletedRead => ({
  posts: [post("300"), post("200"), post("100")],
  mediaPostIds: [],
  exhausted: true,
  ...overrides,
});

const watermark = (overrides: Partial<XWatermark> = {}): XWatermark => ({
  v: 1,
  completeThroughId: "300",
  tweetIds: ["300", "200", "100"],
  mediaPostIds: [],
  bindingAddress: null,
  recordedAt: "2026-08-06T09:00:00.000Z",
  ...overrides,
});

const archived = (tweetIds: string[], mediaPostIds: string[] = []): ArchivedSets => ({
  txids: ["a".repeat(64)],
  tweetIds: new Set(tweetIds),
  mediaPostIds: new Set(mediaPostIds),
});

describe("newestTweetId", () => {
  it("compares snowflakes numerically, not lexicographically", () => {
    // Lexicographic max would call "999" newer than "10000".
    expect(newestTweetId(["999", "10000"])).toBe("10000");
  });

  it("survives ids past 2^53, where Number comparison lies", () => {
    expect(newestTweetId(["9007199254740993", "9007199254740992"])).toBe("9007199254740993");
  });

  it("skips a corrupt id rather than bricking the archive", () => {
    expect(newestTweetId(["not-a-number", "42"])).toBe("42");
  });

  it("is null when nothing numeric remains", () => {
    expect(newestTweetId([])).toBeNull();
    expect(newestTweetId(["nope"])).toBeNull();
  });
});

describe("watermarkFromRead — recording (the sparse-archive-refuses-to-watermark rule)", () => {
  it("records a watermark from an unbounded read that exhausted the timeline", () => {
    const at = new Date("2026-08-06T10:00:00.000Z");
    const result = watermarkFromRead(read({}), null, at);
    expect(result).toEqual({
      v: 1,
      completeThroughId: "300",
      tweetIds: ["300", "200", "100"],
      mediaPostIds: [],
      bindingAddress: null,
      recordedAt: "2026-08-06T10:00:00.000Z",
    });
  });

  it("REFUSES to record from a read the page budget ended — a sparse read is not completeness", () => {
    // This is the refuted axiom made unrepresentable: a default ~100-post read
    // stops on its page budget, so it can never write "complete through" data.
    expect(watermarkFromRead(read({ exhausted: false }), null)).toBeNull();
  });

  it("refuses to record from an empty delivery — there is no id to be complete through", () => {
    expect(watermarkFromRead(read({ posts: [] }), null)).toBeNull();
  });

  it("captures a binding line seen in the delivered posts, so the reward-routing guard has its data", () => {
    const result = watermarkFromRead(read({ posts: [post("300"), bindingPost("200")] }), null);
    expect(result?.bindingAddress).toBe(BINDING_ADDRESS);
  });

  it("captures which delivered posts carried media, so the backfill guard has its data", () => {
    const result = watermarkFromRead(read({ mediaPostIds: ["200"] }), null);
    expect(result?.mediaPostIds).toEqual(["200"]);
  });
});

describe("watermarkFromRead — advancing on a bounded read", () => {
  it("advances by union when the bounded delta itself exhausted X's remainder", () => {
    const prior = watermark();
    const result = watermarkFromRead(
      read({ posts: [post("500"), post("400")], sinceId: "300" }),
      prior,
    );
    expect(result?.completeThroughId).toBe("500");
    expect(result?.tweetIds.sort()).toEqual(["100", "200", "300", "400", "500"].sort());
  });

  it("a budget-ended bounded read NEVER advances — the hole it left must be re-fetched next time", () => {
    const result = watermarkFromRead(
      read({ posts: [post("500")], sinceId: "300", exhausted: false }),
      watermark(),
    );
    expect(result).toBeNull();
  });

  it("an empty delta advances nothing — no data changed", () => {
    expect(watermarkFromRead(read({ posts: [], sinceId: "300" }), watermark())).toBeNull();
  });

  it("a bounded read without a prior record refuses rather than invent completeness", () => {
    expect(watermarkFromRead(read({ posts: [post("500")], sinceId: "300" }), null)).toBeNull();
  });

  it("a binding tweet arriving IN the delta poisons future bounds — the app must keep fetching it", () => {
    const result = watermarkFromRead(
      read({ posts: [bindingPost("500")], sinceId: "300" }),
      watermark(),
    );
    expect(result?.bindingAddress).toBe(BINDING_ADDRESS);
  });

  it("a prior binding survives an advance whose delta carries none", () => {
    const result = watermarkFromRead(
      read({ posts: [post("500")], sinceId: "300" }),
      watermark({ bindingAddress: BINDING_ADDRESS }),
    );
    expect(result?.bindingAddress).toBe(BINDING_ADDRESS);
  });

  it("unions media posts across advances", () => {
    const result = watermarkFromRead(
      read({ posts: [post("500")], mediaPostIds: ["500"], sinceId: "300" }),
      watermark({ mediaPostIds: ["200"] }),
    );
    expect(result?.mediaPostIds.sort()).toEqual(["200", "500"]);
  });
});

describe("consumableSinceId — every guard refuses toward the full read", () => {
  it("consumes a covered, unbound, media-settled watermark", () => {
    expect(consumableSinceId(watermark(), archived(["300", "200", "100"]))).toBe("300");
  });

  it("no watermark, no bound", () => {
    expect(consumableSinceId(null, archived(["300"]))).toBeNull();
  });

  it("COVERAGE: a delivered post missing from the chain refuses the bound — delivery is not inscription", () => {
    // The exhaustive read delivered 300/200/100 but only 300 was inscribed. A
    // bound at 300 would hide 200 and 100 forever; the full read heals them.
    expect(consumableSinceId(watermark(), archived(["300"]))).toBeNull();
  });

  it("REWARD ROUTING: a binding at or below the watermark refuses the bound", () => {
    // The shipped app scans the FETCHED timeline for the binding tweet to route
    // the reward. Bounded, that scan would miss it and pay the developer.
    expect(
      consumableSinceId(
        watermark({ bindingAddress: BINDING_ADDRESS }),
        archived(["300", "200", "100"]),
      ),
    ).toBeNull();
  });

  it("MEDIA BACKFILL: a media post whose media is not yet on chain refuses the bound", () => {
    expect(
      consumableSinceId(
        watermark({ mediaPostIds: ["200"] }),
        archived(["300", "200", "100"], []),
      ),
    ).toBeNull();
  });

  it("consumes once the media is settled", () => {
    expect(
      consumableSinceId(
        watermark({ mediaPostIds: ["200"] }),
        archived(["300", "200", "100"], ["200"]),
      ),
    ).toBe("300");
  });

  it("an unreadable chain index refuses the bound — nothing was proven", () => {
    expect(consumableSinceId(watermark(), null)).toBeNull();
  });

  it("a corrupt record refuses: non-numeric watermark id", () => {
    expect(
      consumableSinceId(watermark({ completeThroughId: "DROP TABLE" }), archived(["300"])),
    ).toBeNull();
  });

  it("a corrupt record refuses: wrong version or missing arrays", () => {
    expect(
      consumableSinceId(watermark({ v: 2 as unknown as 1 }), archived(["300", "200", "100"])),
    ).toBeNull();
    expect(
      consumableSinceId(
        watermark({ tweetIds: undefined as unknown as string[] }),
        archived(["300", "200", "100"]),
      ),
    ).toBeNull();
  });
});
