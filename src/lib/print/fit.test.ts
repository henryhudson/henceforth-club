import { describe, expect, it } from "vitest";
import { CEIL_PT, FLOOR_PT, START_PT, fitTypeSize } from "./fit";

describe("fitTypeSize", () => {
  it("leaves type alone when the copy already fills the slot", () => {
    const pt = fitTypeSize(() => 200, 200);
    expect(pt).toBe(START_PT);
  });

  it("grows type on a light page until the copy fills the slot", () => {
    const pt = fitTypeSize((size) => 100 * (size / START_PT), 140);
    expect(pt).toBeCloseTo(9.8, 5);
  });

  it("shrinks type on a heavy page until the copy fits the slot", () => {
    const pt = fitTypeSize((size) => 200 * (size / START_PT), 150);
    expect(pt).toBeCloseTo(FLOOR_PT, 5);
  });

  it("does not grow past the ceiling when the page is still light", () => {
    const pt = fitTypeSize(() => 50, 400);
    expect(pt).toBe(CEIL_PT);
  });

  it("steps back one increment when a grow overshoots the slot", () => {
    const pt = fitTypeSize((size) => (size >= 7.4 ? 201 : 100), 200);
    expect(pt).toBeCloseTo(7.2, 5);
  });
});
