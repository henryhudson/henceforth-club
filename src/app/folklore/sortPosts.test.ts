import { describe, it, expect } from "vitest";
import { sortHandlesByAuthorElo, sortPostsByElo, sortPostsByMediaCost, sortPostsByScore } from "./sortPosts";

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

describe("sortPostsByMediaCost", () => {
  const post = (id: string, media?: Array<{ type: string }>) => ({ id, media });

  it("leads with video posts, then photo posts, then bare text", () => {
    const posts = [post("text"), post("photo", [{ type: "photo" }]), post("video", [{ type: "video" }])];
    expect(sortPostsByMediaCost(posts).map((p) => p.id)).toEqual(["video", "photo", "text"]);
  });

  it("a mixed-media post counts as video — the costliest thing in it decides", () => {
    const posts = [post("photos", [{ type: "photo" }]), post("mixed", [{ type: "photo" }, { type: "video" }])];
    expect(sortPostsByMediaCost(posts).map((p) => p.id)).toEqual(["mixed", "photos"]);
  });

  it("keeps the given order within each class, so the teaser never looks shuffled", () => {
    const posts = [post("v1", [{ type: "video" }]), post("t1"), post("v2", [{ type: "video" }]), post("t2")];
    expect(sortPostsByMediaCost(posts).map((p) => p.id)).toEqual(["v1", "v2", "t1", "t2"]);
  });
});
