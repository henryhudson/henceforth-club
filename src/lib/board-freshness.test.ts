import { describe, it, expect } from "vitest";
import { boardGeneratedAt, describeFreshness } from "./board-freshness";

describe("board freshness", () => {
  it("prefers the machine-readable stamp over the prose one", () => {
    const at = boardGeneratedAt({
      generatedAt: "2026-08-28T08:44:00+01:00",
      generated: "2026-08-24 06:00 · an older sentence",
    });
    expect(at?.toISOString()).toBe("2026-08-28T07:44:00.000Z");
  });

  it("falls back to the leading timestamp of the prose sentence", () => {
    const at = boardGeneratedAt({
      generated: "2026-08-28 08:44 · nine findings confirmed, three refuted",
    });
    expect(at).not.toBeNull();
    expect(at?.getFullYear()).toBe(2026);
    expect(at?.getMonth()).toBe(7); // August
    expect(at?.getDate()).toBe(28);
  });

  it("returns null when there is no timestamp to read", () => {
    expect(boardGeneratedAt({ generated: "now" })).toBeNull();
    expect(boardGeneratedAt({})).toBeNull();
    expect(boardGeneratedAt(null)).toBeNull();
    expect(boardGeneratedAt({ generatedAt: "not a date" })).toBeNull();
  });

  it("names the age in days once a board is more than a day old", () => {
    const now = new Date("2026-08-28T09:00:00Z");
    const four = describeFreshness(new Date("2026-08-24T09:00:00Z"), now);
    expect(four.stale).toBe(true);
    expect(four.label).toBe("4 days old");
    expect(Math.round(four.ageHours ?? 0)).toBe(96);
  });

  it("a board generated this morning is not stale", () => {
    const now = new Date("2026-08-28T09:00:00Z");
    expect(describeFreshness(new Date("2026-08-28T08:44:00Z"), now)).toMatchObject({
      stale: false,
      unknown: false,
      label: "less than an hour old",
    });
    expect(describeFreshness(new Date("2026-08-28T04:00:00Z"), now).label).toBe("5 hours old");
  });

  it("an unreadable timestamp fails closed — unknown counts as stale", () => {
    // The point of the whole module: a board whose age cannot be established
    // must never render the same as one known to be current.
    expect(describeFreshness(null, new Date("2026-08-28T09:00:00Z"))).toMatchObject({
      stale: true,
      unknown: true,
      label: "age unknown",
    });
  });

  it("clock skew ahead of the server is not reported as stale", () => {
    const now = new Date("2026-08-28T09:00:00Z");
    expect(describeFreshness(new Date("2026-08-28T09:05:00Z"), now)).toMatchObject({
      stale: false,
      label: "just now",
    });
  });

  it("honours a caller-supplied threshold", () => {
    const now = new Date("2026-08-28T09:00:00Z");
    const sixHours = new Date("2026-08-28T03:00:00Z");
    expect(describeFreshness(sixHours, now, 24).stale).toBe(false);
    expect(describeFreshness(sixHours, now, 4).stale).toBe(true);
  });
});
