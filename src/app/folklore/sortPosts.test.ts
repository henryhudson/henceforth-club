import { describe, it, expect } from "vitest";
import { hotScore, sortHandlesByAuthorElo, sortPostsByElo, sortPostsByHot, sortPostsByScore } from "./sortPosts";

describe("sortPostsByScore", () => {
  it("orders by score desc, missing score = 0, stable on ties", () => {
    const posts = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const scores = { b: 900, c: -100, a: 900 };
    // a(900,i0), b(900,i1) keep input order; d(0) above c(-100)
    expect(sortPostsByScore(posts, scores).map((p) => p.id)).toEqual(["a", "b", "d", "c"]);
  });
});

describe("sortPostsByElo", () => {
  it("orders by rating descending; a never-dueled text sits at the start rating, not the bottom", () => {
    const posts = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const table = {
      b: { rating: 1600, duels: 25 },
      c: { rating: 1400, duels: 3 },
    };
    // a never dueled → 1500: below b's 1600, above c's 1400.
    expect(sortPostsByElo(posts, table).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("keeps the given order on equal ratings — a reorder never looks arbitrary", () => {
    const posts = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const table = {
      a: { rating: 1500, duels: 21 },
      c: { rating: 1500, duels: 4 },
    };
    // All three sit at 1500 (b by default) — the input order holds.
    expect(sortPostsByElo(posts, table).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("sortHandlesByAuthorElo", () => {
  it("rated authors first by rating descending; unrated keep their given order after them", () => {
    const handles = [
      { handle: "ann", latestMs: 4 },
      { handle: "ben", latestMs: 3 },
      { handle: "cat", latestMs: 2 },
      { handle: "dot", latestMs: 1 },
    ];
    const ratings = { cat: 1550, ben: 1610 };
    expect(sortHandlesByAuthorElo(handles, ratings).map((h) => h.handle)).toEqual([
      "ben",
      "cat",
      "ann",
      "dot",
    ]);
  });

  it("with no ratings at all the given order is untouched", () => {
    const handles = [
      { handle: "ann", latestMs: 2 },
      { handle: "ben", latestMs: 1 },
    ];
    expect(sortHandlesByAuthorElo(handles, {})).toEqual(handles);
  });

  it("keeps the given order between equally rated authors", () => {
    const handles = [{ handle: "ann", latestMs: 2 }, { handle: "ben", latestMs: 1 }];
    const ratings = { ann: 1500, ben: 1500 };
    expect(sortHandlesByAuthorElo(handles, ratings).map((h) => h.handle)).toEqual(["ann", "ben"]);
  });
});

describe("the hot fold", () => {
  const NOW = Date.parse("2026-07-26T12:00:00Z");
  const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
  const post = (id: string, at: string, media?: Array<{ type: string }>) => ({ id, at, media });
  const video = (id: string, agedDays: number) => post(id, daysAgo(agedDays), [{ type: "video" }]);
  const text = (id: string, agedDays: number) => post(id, daysAgo(agedDays));
  // Founding costs measured on the witness archive: text ~15 sats, a photo
  // ~8.6k, a small reply clip ~1.4k, the big tutorials 1.7 million.
  const TUTORIAL = 1_700_000, CLIP = 1_400, TEXT_COST = 15;

  it("a settled tutorial outranks old text — the shelf is real upload cost", () => {
    const founding = { t: TEXT_COST, v: TUTORIAL };
    expect(sortPostsByHot([text("t", 400), video("v", 400)], {}, founding, NOW).map((p) => p.id)).toEqual(["v", "t"]);
  });

  it("a newer fourteen-kilobyte clip never outranks a settled fifteen-megabyte tutorial", () => {
    // The mouth-of-Sauron pin: under the flat class constant both were 'a
    // video' and recency decided; under the cost prior the tutorial's
    // 1.7 million founding sats (~249) hold above the clip (~126 + spent
    // freshness) once its first days pass.
    const founding = { clip: CLIP, tutorial: TUTORIAL };
    const posts = [video("clip", 11), video("tutorial", 35)];
    expect(sortPostsByHot(posts, {}, founding, NOW).map((p) => p.id)).toEqual(["tutorial", "clip"]);
  });

  it("brand-new bare text never displaces the archive's monuments", () => {
    const founding = { fresh: TEXT_COST, tutorial: TUTORIAL };
    expect(hotScore(text("fresh", 0), 0, TEXT_COST, NOW)).toBeLessThan(
      hotScore(video("tutorial", 400), 0, TUTORIAL, NOW),
    );
    void founding;
  });

  it("earned kudos outrank everything unpaid once content settles", () => {
    const founding = { fresh: TEXT_COST, tutorial: TUTORIAL, paid: TEXT_COST };
    const posts = [text("fresh", 0), video("tutorial", 35), text("paid", 300)];
    expect(sortPostsByHot(posts, { paid: 5000 }, founding, NOW).map((p) => p.id)[0]).toBe("paid");
  });

  it("the paid term is log-damped — the first satoshis move a post most", () => {
    const first = hotScore(text("p", 300), 100, 0, NOW) - hotScore(text("p", 300), 0, 0, NOW);
    const later = hotScore(text("p", 300), 10_100, 0, NOW) - hotScore(text("p", 300), 10_000, 0, NOW);
    expect(first).toBeGreaterThan(later * 10);
  });

  it("without founding data the class floors hold — a video archive never collapses to freshness", () => {
    expect(hotScore(video("v", 400), 0, 0, NOW)).toBeCloseTo(100, 6);
    expect(hotScore(post("p", daysAgo(400), [{ type: "photo" }]), 0, 0, NOW)).toBeCloseTo(30, 6);
  });

  it("an unparseable date counts as old, never as new", () => {
    const undated = { id: "u", at: "not a date", media: undefined };
    expect(hotScore(undated, 0, 0, NOW)).toBe(0);
  });

  it("ties keep input order, so equal posts never look shuffled", () => {
    const posts = [text("a", 400), text("b", 400)];
    expect(sortPostsByHot(posts, {}, {}, NOW).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
