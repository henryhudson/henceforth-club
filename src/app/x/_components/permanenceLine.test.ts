import { describe, it, expect } from "vitest";
import { buildPermanenceLine } from "./permanenceLine";

describe("buildPermanenceLine", () => {
  it("assembles every segment when every datum is known", () => {
    expect(
      buildPermanenceLine({
        postCount: 1435,
        photoCount: 154,
        txCount: 3,
        firstInscribedLabel: "1 Jul 2026",
        isPreview: false,
      }),
    ).toBe("1,435 posts · 154 photos · archived across 3 transactions · first inscribed 1 Jul 2026");
  });

  it("shows the live-preview line instead of any on-chain segments, even when other data is present", () => {
    expect(
      buildPermanenceLine({ postCount: 20, photoCount: 3, txCount: 1, isPreview: true }),
    ).toBe("20 posts · live preview — not yet inscribed");
  });

  it("omits a segment whose datum is unknown", () => {
    expect(buildPermanenceLine({ postCount: 5, txCount: 1, isPreview: false })).toBe(
      "5 posts · archived across 1 transaction",
    );
  });

  it("shows a known zero photo count rather than omitting it", () => {
    expect(buildPermanenceLine({ postCount: 5, photoCount: 0, isPreview: false })).toBe(
      "5 posts · 0 photos",
    );
  });

  it("pluralizes a single post, photo, and transaction correctly", () => {
    expect(
      buildPermanenceLine({ postCount: 1, photoCount: 1, txCount: 1, isPreview: false }),
    ).toBe("1 post · 1 photo · archived across 1 transaction");
  });

  it("formats large counts with thousands separators", () => {
    expect(buildPermanenceLine({ postCount: 12345, isPreview: false })).toBe("12,345 posts");
  });
});
