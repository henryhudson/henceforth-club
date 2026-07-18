import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("excludes the unlisted /provenance route", () => {
    const entries = sitemap();
    const hasProvenance = entries.some((e) =>
      e.url.replace(/\/$/, "").endsWith("/provenance"),
    );
    expect(hasProvenance).toBe(false);
  });

  it("includes discovery routes from the site map pass", () => {
    const urls = sitemap().map((e) => e.url);
    const mustInclude = [
      "https://henceforth.club/about",
      "https://henceforth.club/articles/trust-local-but-verify",
      "https://henceforth.club/hansard/this-week",
      "https://henceforth.club/docs/reference",
      "https://henceforth.club/docs/wallet",
      "https://henceforth.club/henceforth/privacy",
      "https://henceforth.club/hansard/privacy",
      "https://henceforth.club/dadeckofcards/privacy",
    ];
    for (const url of mustInclude) {
      expect(urls).toContain(url);
    }
  });

  it("includes published this-week digests", () => {
    const weeks = sitemap().filter((e) =>
      e.url.includes("/hansard/this-week/"),
    );
    expect(weeks.length).toBeGreaterThan(0);
  });
});
