import { describe, expect, it } from "vitest";
import { jobRefusalMessage } from "./jobRefusalMessage";

describe("jobRefusalMessage", () => {
  const known = [
    "bad-input",
    "too-large",
    "bad-zip",
    "no-tweets-file",
    "no-posts",
    "no-handle",
    "at-capacity",
    "store-unavailable",
  ];

  it.each(known)("has distinct, non-empty copy for %s", (reason) => {
    expect(jobRefusalMessage(reason).length).toBeGreaterThan(0);
  });

  it("every known reason gets its own message", () => {
    const messages = new Set(known.map(jobRefusalMessage));
    expect(messages.size).toBe(known.length);
  });

  it("falls back to an honest generic message for an unrecognised reason", () => {
    expect(jobRefusalMessage("something-new")).toMatch(/nothing was charged/i);
  });

  it("stays total for a missing or non-string reason", () => {
    expect(jobRefusalMessage(undefined)).toMatch(/nothing was charged/i);
  });
});
