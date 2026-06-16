import { describe, it, expect } from "vitest";
import { episodes, getEpisode, publishedEpisodes, adjacentEpisodes } from "./episodes";

describe("episodes manifest", () => {
  it("finds Episode 1 by slug", () => {
    const ep = getEpisode("what-is-henceforth");
    expect(ep?.number).toBe(1);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getEpisode("nope")).toBeUndefined();
  });

  it("publishedEpisodes() returns only episodes flagged published", () => {
    expect(publishedEpisodes().every((e) => e.published)).toBe(true);
    expect(publishedEpisodes().some((e) => e.slug === "what-is-henceforth")).toBe(true);
    expect(publishedEpisodes().some((e) => e.slug === "backwards-maths")).toBe(true);
  });

  it("gives every published episode the content the page needs", () => {
    for (const e of publishedEpisodes()) {
      expect(e.codeAlong?.length).toBeGreaterThan(0);
      expect(e.concepts?.length).toBeGreaterThan(0);
      expect(e.transcript?.length).toBeGreaterThan(0);
      expect(e.video?.mp4).toBeTruthy();
    }
  });

  it("links neighbours by number across all episodes", () => {
    expect(adjacentEpisodes("what-is-henceforth").next?.slug).toBe("the-stack");
    expect(adjacentEpisodes("what-is-henceforth").prev).toBeUndefined();
  });

  it("has unique slugs", () => {
    const slugs = episodes.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
