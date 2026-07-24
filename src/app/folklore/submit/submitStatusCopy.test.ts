import { describe, expect, it } from "vitest";
import { submitStatusCopy } from "./submitStatusCopy";

describe("submitStatusCopy — submit-specific states", () => {
  it("names the kind while the record is being written", () => {
    expect(submitStatusCopy({ state: "funded", kind: "link" }).body).toContain("Your link");
    expect(submitStatusCopy({ state: "funded", kind: "comment" }).body).toContain("Your comment");
  });

  it("says the record is being added to the board once inscribed", () => {
    const view = submitStatusCopy({ state: "inscribed", kind: "link" });
    expect(view.heading).toBe("On Bitcoin");
    expect(view.body).toContain("board");
  });

  it("lands a link on the board and a comment under its link", () => {
    expect(submitStatusCopy({ state: "done", kind: "link" }).body).toContain("folklore board");
    expect(submitStatusCopy({ state: "done", kind: "comment" }).body).toContain("under its link");
  });

  it("never mentions an archive or a handle", () => {
    for (const state of ["quoted", "awaiting-payment", "funded", "inscribed", "done"] as const) {
      const view = submitStatusCopy({ state, kind: "link" });
      expect(`${view.heading} ${view.body}`).not.toContain("archive");
      expect(view.body).not.toContain("/folklore/");
    }
  });
});

describe("submitStatusCopy — delegated refund honesty", () => {
  it("keeps the archive flow's distinction between a refund and an unpaid expiry", () => {
    const refunded = submitStatusCopy({
      state: "swept",
      kind: "link",
      failureReason: "broadcast-failed",
      sweepTxid: "b".repeat(64),
    });
    expect(refunded.heading).toBe("Payment returned");

    const expired = submitStatusCopy({ state: "swept", kind: "link" });
    expect(expired.heading).toBe("Quote expired");
    expect(expired.body).toContain("Nothing was charged");
  });

  it("says why a payment is coming back while it sweeps", () => {
    const view = submitStatusCopy({ state: "sweeping", kind: "comment", failureReason: "expired" });
    expect(view.heading).toBe("Returning your payment");
    expect(view.body).toContain("expired");
  });
});
