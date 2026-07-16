import { describe, it, expect } from "vitest";
import { newestTweetId, archiveReadPlan } from "./xReadPlan";
import { X_TIMELINE_CEILING } from "./xfetch";

// Snowflake ids are numeric strings that grow with time — but they grow in
// VALUE, not in length lockstep, so the max must be taken numerically. A
// lexicographic max would call "999" newer than "10000".
describe("newestTweetId", () => {
  it("takes the numeric max, not the lexicographic one", () => {
    expect(newestTweetId(new Set(["999", "10000"]))).toBe("10000");
  });

  it("returns null for an empty set — no archive means no bound", () => {
    expect(newestTweetId(new Set())).toBeNull();
  });

  it("survives ids beyond Number.MAX_SAFE_INTEGER", () => {
    // Real X ids are 19 digits — past 2^53, where Number comparison lies.
    expect(
      newestTweetId(new Set(["1811230481123456789", "1811230481123456790"])),
    ).toBe("1811230481123456790");
  });

  it("ignores a non-numeric id rather than throwing", () => {
    expect(newestTweetId(new Set(["not-an-id", "42"]))).toBe("42");
  });
});

// THE one bound. Quote and archive must price the same read, so both derive
// from this plan — pricing drift between them is unrepresentable as long as
// neither route computes pages or billed posts on its own.
describe("archiveReadPlan", () => {
  it("plans a full read when nothing is archived", () => {
    const plan = archiveReadPlan(250, new Set());
    expect(plan.sinceId).toBeUndefined();
    expect(plan.billedPosts).toBe(250);
    expect(plan.maxPages).toBe(3);
  });

  it("caps a full read at X's timeline ceiling", () => {
    const plan = archiveReadPlan(10_000, new Set());
    expect(plan.billedPosts).toBe(X_TIMELINE_CEILING);
    expect(plan.maxPages).toBe(X_TIMELINE_CEILING / 100);
  });

  it("plans a delta read from the newest archived id", () => {
    const archived = new Set(
      Array.from({ length: 150 }, (_, i) => `${1000 + i}`),
    );
    const plan = archiveReadPlan(250, archived);
    expect(plan.sinceId).toBe("1149");
    // 250 lifetime minus 150 archived — the read only pays for what is new.
    expect(plan.billedPosts).toBe(100);
    expect(plan.maxPages).toBe(1);
  });

  it("floors the estimate at zero when the archive holds more than X reports", () => {
    // Deletions shrink postCount below what is already on chain. The read is
    // then a probe: one page, since-bounded, billed for zero posts — the
    // gate's own +1 resource floor still prices the head fetch.
    const archived = new Set(Array.from({ length: 300 }, (_, i) => `${i + 1}`));
    const plan = archiveReadPlan(200, archived);
    expect(plan.sinceId).toBe("300");
    expect(plan.billedPosts).toBe(0);
    expect(plan.maxPages).toBe(1);
  });

  it("plans a full read when the archived set is empty even if postCount is huge", () => {
    const plan = archiveReadPlan(3200, new Set());
    expect(plan.sinceId).toBeUndefined();
    expect(plan.billedPosts).toBe(3200);
  });
});
