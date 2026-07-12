import { describe, it, expect } from "vitest";
import { pagesForPostCount, X_TIMELINE_CEILING, POSTS_PER_PAGE } from "./xfetch";
import { resourcesForPosts } from "./xGate";
import { resourcesToUsd } from "./xSpend";

describe("pagesForPostCount", () => {
  it("pages the whole timeline, and never past X's own ceiling", () => {
    expect(pagesForPostCount(0)).toBe(1); // an empty account still costs one read
    expect(pagesForPostCount(1)).toBe(1);
    expect(pagesForPostCount(100)).toBe(1);
    expect(pagesForPostCount(101)).toBe(2);
    expect(pagesForPostCount(1498)).toBe(15); // henryhudson6 as of 2026-07-12
    // X will not read further back than the ceiling — asking for more buys nothing.
    expect(pagesForPostCount(X_TIMELINE_CEILING)).toBe(X_TIMELINE_CEILING / POSTS_PER_PAGE);
    expect(pagesForPostCount(50_000)).toBe(X_TIMELINE_CEILING / POSTS_PER_PAGE);
  });
});

describe("resourcesForPosts — the fee must cover the read", () => {
  it("prices a read by the posts it actually returns, plus the user object", () => {
    expect(resourcesForPosts(100)).toBe(101); // the old flat text price, derived
    expect(resourcesForPosts(1498)).toBe(1499);
    expect(resourcesForPosts(0)).toBe(1);
  });

  it("a whole-profile read costs materially more than one page — a flat fee would sell it at a loss", () => {
    const onePage = resourcesToUsd(resourcesForPosts(100));
    const wholeProfile = resourcesToUsd(resourcesForPosts(1498));
    expect(wholeProfile).toBeGreaterThan(onePage * 10);
    // The rule made literal: what we charge must cover what X charges us.
    expect(wholeProfile).toBeCloseTo(1499 * 0.005, 6);
  });

  it("media no longer doubles the bill — expansions ride the text read for free", () => {
    // Before 2026-07-12 a media read was billed at 201 resources (a second pass
    // over the same timeline). It is now the same read, so the same price.
    expect(resourcesForPosts(100)).toBeLessThan(201);
  });
});
