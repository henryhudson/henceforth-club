import { describe, it, expect } from "vitest";
import { hotScore, showcasePosts, sortHandlesByAuthorElo, sortPostsByElo, sortPostsByHot, sortPostsByScore } from "./sortPosts";

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

describe("the ranking — satoshis earned plus what it cost to upload", () => {
  const video = (id: string) => ({ id, media: [{ type: "video" }] });
  const text = (id: string) => ({ id, media: undefined as Array<{ type: string }> | undefined });
  const photo = (id: string) => ({ id, media: [{ type: "photo" }] });
  // Founding costs measured on the witness archive: text ~15 sats, a photo
  // ~8.6k, a small reply clip ~1.4k, the big tutorials 1.7 million.
  const TUTORIAL = 1_700_000, CLIP = 1_400, TEXT_COST = 15;

  it("rank IS the sum — upload cost orders the unvoted archive", () => {
    const founding = { t: TEXT_COST, clip: CLIP, tutorial: TUTORIAL };
    const posts = [text("t"), video("clip"), video("tutorial")];
    expect(sortPostsByHot(posts, {}, founding).map((p) => p.id)).toEqual(["tutorial", "clip", "t"]);
  });

  it("the mouth-of-Sauron pin: a small reply clip never outranks a big tutorial, however new", () => {
    const founding = { clip: CLIP, tutorial: TUTORIAL };
    expect(sortPostsByHot([video("clip"), video("tutorial")], {}, founding).map((p) => p.id)).toEqual([
      "tutorial",
      "clip",
    ]);
  });

  it("kudos add linearly — earned satoshis lift a post exactly as far as they say", () => {
    const founding = { t: TEXT_COST, clip: CLIP };
    expect(hotScore(text("t"), CLIP, TEXT_COST)).toBeGreaterThan(hotScore(video("clip"), 0, CLIP));
    expect(hotScore(text("t"), 0, TEXT_COST)).toBe(TEXT_COST);
    void founding;
  });

  it("enough kudos outrank any upload — money others committed can top the biggest monument", () => {
    const founding = { paid: TEXT_COST, tutorial: TUTORIAL };
    const posts = [video("tutorial"), text("paid")];
    expect(sortPostsByHot(posts, { paid: TUTORIAL + 1 }, founding).map((p) => p.id)[0]).toBe("paid");
  });

  it("without founding data the class floors hold, so a foreign archive still shows media first", () => {
    expect(hotScore(video("v"), 0, 0)).toBe(100);
    expect(hotScore(photo("p"), 0, 0)).toBe(30);
    expect(hotScore(text("t"), 0, 0)).toBe(0);
  });

  it("ties keep input order — equal-value text reads newest-first, exactly as the archive arrives", () => {
    const posts = [text("a"), text("b")];
    expect(sortPostsByHot(posts, {}, { a: TEXT_COST, b: TEXT_COST }).map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("showcasePosts", () => {
  const posts = [{ id: "hot1" }, { id: "ep9" }, { id: "hot2" }, { id: "kepler" }];

  it("seats the owner's picks first in listed order, hot order filling the rest", () => {
    expect(showcasePosts(posts, ["kepler", "ep9"], 4).map((p) => p.id)).toEqual(["kepler", "ep9", "hot1", "hot2"]);
  });

  it("skips a pick the archive does not hold and never duplicates a seat", () => {
    expect(showcasePosts(posts, ["gone", "ep9"], 3).map((p) => p.id)).toEqual(["ep9", "hot1", "hot2"]);
  });
});
