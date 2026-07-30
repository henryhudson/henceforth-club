import { describe, expect, it } from "vitest";
import { formatPence, parseAmount, sumPence } from "./money";

describe("parseAmount", () => {
  it("reads signed two-place figures as pence", () => {
    expect(parseAmount("-19.00")).toBe(-1900);
    expect(parseAmount("6.07")).toBe(607);
    expect(parseAmount("-429.00")).toBe(-42900);
    expect(parseAmount("0.00")).toBe(0);
  });

  it("refuses anything that is not exactly two places", () => {
    expect(parseAmount("-19")).toBeNull();
    expect(parseAmount("19.0")).toBeNull();
    expect(parseAmount("19.005")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("nineteen")).toBeNull();
    expect(parseAmount("1,900.00")).toBeNull();
    expect(parseAmount(" 19.00")).toBeNull();
  });

  it("round-trips through formatPence", () => {
    for (const s of ["-19.00", "6.07", "0.00", "-2589.66", "1829.00"]) {
      expect(formatPence(parseAmount(s) as number)).toBe(s);
    }
  });
});

describe("formatPence", () => {
  it("keeps the minus sign on amounts under a pound", () => {
    expect(formatPence(-7)).toBe("-0.07");
    expect(formatPence(7)).toBe("0.07");
  });
});

describe("sumPence", () => {
  // The 2025 period as recorded to 2025-07-03: eleven outgoings, seven receipts.
  const out = [
    "-49.95", "-19.00", "-429.00", "-49.95", "-19.00", "-49.95",
    "-19.00", "-49.95", "-100.00", "-22.00", "-49.95",
  ];
  const inn = ["20.91", "6.91", "6.13", "3.57", "3.55", "6.07", "12.97"];

  it("sums the period exactly, where floating point would not", () => {
    expect(sumPence(out)).toBe(-85775);
    expect(sumPence(inn)).toBe(6011);
    expect(sumPence([...out, ...inn])).toBe(-79764);
  });

  it("beats the naive floating-point sum this replaces", () => {
    // The spreadsheet stored its 2023 total as 2589.659999999998. This is the
    // same failure on this period's own figures: summing the pounds as doubles
    // lands on -797.64000000000010004, which is a different double from the
    // -797.64 the accounts must state.
    //
    // Note the receipts alone would NOT show this — their sum happens to round
    // to the same double as the literal. Lossiness is input-dependent, which is
    // exactly why it cannot be relied upon to show up in casual testing.
    const naive = [...out, ...inn].reduce((t, a) => t + Number(a), 0);
    expect(naive).not.toBe(-797.64);
    expect(sumPence([...out, ...inn]) / 100).toBe(-797.64);
  });

  it("is empty-safe", () => {
    expect(sumPence([])).toBe(0);
  });
});
