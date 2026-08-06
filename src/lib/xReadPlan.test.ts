import { describe, expect, it } from "vitest";
import { archiveReadPlan } from "./xReadPlan";
import { POSTS_PER_PAGE, X_TIMELINE_CEILING } from "./xfetch";

describe("archiveReadPlan — unbounded (no consumable watermark)", () => {
  it("is exactly today's behaviour: pages for the reachable timeline, billed at the reachable count", () => {
    expect(archiveReadPlan(1498, null)).toEqual({ maxPages: 15, billedPosts: 1498 });
  });

  it("caps at X's own ceiling", () => {
    expect(archiveReadPlan(99_000, null)).toEqual({
      maxPages: X_TIMELINE_CEILING / POSTS_PER_PAGE,
      billedPosts: X_TIMELINE_CEILING,
    });
  });

  it("floors at one page for a tiny or zero count", () => {
    expect(archiveReadPlan(0, null)).toEqual({ maxPages: 1, billedPosts: 0 });
  });
});

describe("archiveReadPlan — bounded (review-mandated properties)", () => {
  it("keeps the FULL page budget: a deflated estimate must never truncate the delta", () => {
    expect(archiveReadPlan(1498, "1500").maxPages).toBe(15);
  });

  it("prices the worst case the page budget PERMITS, never an estimate of the delta", () => {
    // The refuted design floored the fee near zero while a since-bounded page
    // could still return 100 real posts — a ~100x under-reservation of the
    // daily budget ledger, repeatable per half-cent payment.
    expect(archiveReadPlan(1498, "1500").billedPosts).toBe(15 * POSTS_PER_PAGE);
  });

  it("a bounded plan can never reserve less than the unbounded one — no discount route exists", () => {
    for (const postCount of [1, 99, 100, 101, 1498, 3200, 99_000]) {
      const bounded = archiveReadPlan(postCount, "9");
      const unbounded = archiveReadPlan(postCount, null);
      expect(bounded.billedPosts).toBeGreaterThanOrEqual(unbounded.billedPosts);
      expect(bounded.maxPages).toBe(unbounded.maxPages);
    }
  });

  it("carries the bound through for the fetch layer", () => {
    expect(archiveReadPlan(500, "12345").sinceId).toBe("12345");
    expect(archiveReadPlan(500, null).sinceId).toBeUndefined();
  });
});
