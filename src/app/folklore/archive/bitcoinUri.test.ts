import { describe, expect, it } from "vitest";
import { bitcoinAmount, bitcoinUri } from "./bitcoinUri";

describe("bitcoinAmount", () => {
  it("trims trailing zeros", () => {
    expect(bitcoinAmount(9_290_500)).toBe("0.092905");
  });

  it("trims down to a whole bitcoin with no trailing point", () => {
    expect(bitcoinAmount(100_000_000)).toBe("1");
  });

  it("keeps a non-zero final digit at the satoshi floor", () => {
    expect(bitcoinAmount(546)).toBe("0.00000546");
  });

  it("trims a single trailing zero without dropping a significant digit", () => {
    expect(bitcoinAmount(550)).toBe("0.0000055");
  });

  it("prices the fee-plus-premium total exactly", () => {
    expect(bitcoinAmount(500 + 9_290_000)).toBe(bitcoinAmount(9_290_500));
  });
});

describe("bitcoinUri", () => {
  it("builds a standard BIP-21 uniform resource identifier", () => {
    expect(bitcoinUri("1BoatSLRHtKNngkdXEeobR76b53LETtpyT", 9_290_500)).toBe(
      "bitcoin:1BoatSLRHtKNngkdXEeobR76b53LETtpyT?amount=0.092905",
    );
  });
});
