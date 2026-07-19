import { describe, expect, it } from "vitest";
import { isOwnWork, OWN_WORK_LINE } from "./ownWork";

describe("isOwnWork — the self-kudos check", () => {
  it("matches the payer's profile to the receiving author", () => {
    expect(isOwnWork("henry", "henry")).toBe(true);
    expect(isOwnWork("henry", "ben")).toBe(false);
  });

  it("compares case-insensitively, as X handles are", () => {
    expect(isOwnWork("henry", "Henry")).toBe(true);
    expect(isOwnWork("HENRY", "henry")).toBe(true);
  });

  it("carries a friendly refusal line for the routes to answer with", () => {
    expect(OWN_WORK_LINE.length).toBeGreaterThan(0);
    expect(OWN_WORK_LINE).not.toMatch(/satoshi/i); // kudos never called satoshis in copy
  });
});
