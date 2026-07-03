import { describe, it, expect } from "vitest";
import { advanceIndex } from "./readerIndex";

describe("advanceIndex", () => {
  it("lands the first `j` (direction 1) on the first post, not the second", () => {
    expect(advanceIndex(null, 1, 5)).toBe(0);
  });

  it("lands the first `k` (direction -1) on the first post too, not the last", () => {
    expect(advanceIndex(null, -1, 5)).toBe(0);
  });

  it("advances forward from a current index", () => {
    expect(advanceIndex(1, 1, 5)).toBe(2);
  });

  it("advances backward from a current index", () => {
    expect(advanceIndex(2, -1, 5)).toBe(1);
  });

  it("clamps at the last post rather than running past it", () => {
    expect(advanceIndex(4, 1, 5)).toBe(4);
  });

  it("clamps at the first post rather than going negative", () => {
    expect(advanceIndex(0, -1, 5)).toBe(0);
  });

  it("returns 0 for an empty list regardless of direction or current index", () => {
    expect(advanceIndex(null, 1, 0)).toBe(0);
    expect(advanceIndex(null, -1, 0)).toBe(0);
    expect(advanceIndex(3, 1, 0)).toBe(0);
  });
});
