import { describe, expect, it } from "vitest";
import { canRequestPayment } from "./canRequestPayment";

describe("canRequestPayment", () => {
  it("refuses when neither box is checked", () => {
    expect(canRequestPayment(false, false)).toBe(false);
  });

  it("refuses with only the permanence acknowledgment checked", () => {
    expect(canRequestPayment(true, false)).toBe(false);
  });

  it("refuses with only the own-account assertion checked", () => {
    expect(canRequestPayment(false, true)).toBe(false);
  });

  it("permits only once both are checked", () => {
    expect(canRequestPayment(true, true)).toBe(true);
  });
});
