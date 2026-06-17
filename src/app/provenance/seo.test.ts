import { describe, it, expect } from "vitest";
import { robots } from "./seo";

describe("provenance seo", () => {
  it("is noindex / nofollow so it stays reachable only by URL", () => {
    expect(robots.index).toBe(false);
    expect(robots.follow).toBe(false);
  });
});
