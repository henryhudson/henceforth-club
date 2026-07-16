import { describe, it, expect } from "vitest";
import { formatUnixSeconds } from "./PostCard";

describe("formatUnixSeconds", () => {
  it("formats a unix-seconds timestamp the same way formatDate formats a date string", () => {
    const seconds = 1751328000;
    // Same locale/options formatDate uses, computed independently so this
    // assertion holds regardless of the machine's timezone.
    const expected = new Date(seconds * 1000).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(formatUnixSeconds(seconds)).toBe(expected);
  });

  it("returns an empty string for an unknown time", () => {
    expect(formatUnixSeconds(undefined)).toBe("");
  });
});
