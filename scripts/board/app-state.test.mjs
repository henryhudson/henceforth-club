import { describe, it, expect } from "vitest";
import { parseRatings, buildAppState } from "./app-state.mjs";

describe("app state", () => {
  it("parseRatings pulls average + count + version from an iTunes lookup", () => {
    expect(parseRatings({ results: [{ averageUserRating: 4.5, userRatingCount: 12, version: "1.2" }] }))
      .toEqual({ average: 4.5, count: 12, version: "1.2" });
    expect(parseRatings({ results: [] })).toEqual({ average: null, count: 0 });
    expect(parseRatings({})).toEqual({ average: null, count: 0 });
  });

  it("buildAppState joins downloads + ratings per app, analytics + verdict pending", () => {
    const sales = { perApp: [{ app: "deck", units: { thisWeek: 30, lastWeek: 51, deltaPct: -0.41 } }] };
    const out = buildAppState({
      apps: [{ key: "deck", name: "DaDeckOfCards" }, { key: "hansard", name: "Hansard" }],
      sales,
      ratings: { deck: { average: 4.2, count: 8 } },
    });
    expect(out[0]).toMatchObject({
      app: "deck", name: "DaDeckOfCards",
      downloads: { thisWeek: 30, lastWeek: 51 }, rating: { average: 4.2, count: 8 }, analytics: null, verdict: null,
    });
    // an app with no sales row and no ratings degrades gracefully
    expect(out[1]).toMatchObject({ app: "hansard", downloads: null, rating: { average: null, count: 0 } });
  });
});
