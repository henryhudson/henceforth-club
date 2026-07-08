import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { WITNESS_HANDLE } from "./witness";

describe("the witness", () => {
  it("names a handle X would accept", () => {
    expect(WITNESS_HANDLE).toMatch(/^[A-Za-z0-9_]{1,15}$/);
  });

  it("the build-time sample is gone, along with the two claims it made", () => {
    expect(existsSync("src/app/x/real.ts")).toBe(false);
    expect(existsSync("src/app/x/real-data.json")).toBe(false);
  });
});
