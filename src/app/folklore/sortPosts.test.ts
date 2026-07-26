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

  it("an old video outranks old text — the cold-start shelf", () => {
    expect(sortPostsByHot([text("t", 400), video("v", 400)], {}, NOW).map((p) => p.id)).toEqual(["v", "t"]);
  });

  it("a brand-new text post outranks a bare old video for its first fortnight, then sinks beneath it", () => {
    expect(hotScore(text("fresh", 1), 0, NOW)).toBeGreaterThan(hotScore(video("v", 400), 0, NOW));
    expect(hotScore(text("aged", 15), 0, NOW)).toBeLessThan(hotScore(video("v", 400), 0, NOW));
  });

  it("earned kudos outrank settled media and fresh text — but a day-old video is allowed its moment", () => {
    // 1,000 sats ≈ 240 points: above a settled video (prior 100 + spent
    // freshness) and above brand-new bare text (200) — but deliberately
    // BELOW a video in its first days (prior + freshness ≈ 270+), because
    // hot means the new costly thing gets its window before money settles it.
    const posts = [text("fresh", 0), video("settled", 30), text("paid", 300)];
    expect(sortPostsByHot(posts, { paid: 1000 }, NOW).map((p) => p.id)[0]).toBe("paid");
    expect(hotScore(video("day-old", 1), 0, NOW)).toBeGreaterThan(hotScore(text("paid", 300), 1000, NOW));
  });

  it("the paid term is log-damped — the first satoshis move a post most", () => {
    const first = hotScore(text("p", 300), 100, NOW) - hotScore(text("p", 300), 0, NOW);
    const later = hotScore(text("p", 300), 10_100, NOW) - hotScore(text("p", 300), 10_000, NOW);
    expect(first).toBeGreaterThan(later * 10);
  });

  it("an unparseable date counts as old, never as new", () => {
    const undated = { id: "u", at: "not a date", media: undefined };
    expect(hotScore(undated, 0, NOW)).toBe(0);
  });

  it("ties keep input order, so equal posts never look shuffled", () => {
    const posts = [text("a", 400), text("b", 400)];
    expect(sortPostsByHot(posts, {}, NOW).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
