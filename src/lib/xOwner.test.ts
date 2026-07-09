import { describe, expect, it } from "vitest";
import { claimOutcome, type XOwner } from "./xOwner";

const owner = (address: string): XOwner => ({
  address, pubkey: "02".padEnd(66, "a"), boundAt: 1, bindingTxid: "c".repeat(64), bindingPostId: "1",
});

describe("claimOutcome", () => {
  it("establishes ownership when the handle is unclaimed", () => {
    expect(claimOutcome(null, "1AAA")).toBe("establish");
  });

  it("appends when the claimant is the existing owner", () => {
    expect(claimOutcome(owner("1AAA"), "1AAA")).toBe("append");
  });

  it("rejects a claim by a different address than the owner", () => {
    expect(claimOutcome(owner("1AAA"), "1BBB")).toBe("reject");
  });
});
