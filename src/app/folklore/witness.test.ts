import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { PINNED_POST, WITNESS_HANDLE } from "./witness";

describe("the witness", () => {
  it("names a handle X would accept", () => {
    expect(WITNESS_HANDLE).toMatch(/^[A-Za-z0-9_]{1,15}$/);
  });

  it("the build-time sample is gone, along with the two claims it made", () => {
    expect(existsSync("src/app/folklore/real.ts")).toBe(false);
    expect(existsSync("src/app/folklore/real-data.json")).toBe(false);
  });

  it("pins Henry's founding tweet instead of free-floating tagline copy", () => {
    expect(PINNED_POST.id).toBe("2077655210709671962");
    expect(PINNED_POST.handle).toBe(WITNESS_HANDLE);
    expect(PINNED_POST.text).toContain("descendants");
  });
});
