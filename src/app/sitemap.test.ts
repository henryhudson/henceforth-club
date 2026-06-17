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
});
