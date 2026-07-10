import { describe, expect, it } from "vitest";
import { statusCopy } from "./statusCopy";

describe("statusCopy", () => {
  it("quoted — preparing an address, before one exists", () => {
    expect(statusCopy({ state: "quoted", handle: "henry" }).heading).toBe("Preparing a payment address");
  });

  it("awaiting-payment — the address is ready, honestly says nothing is written yet", () => {
    const view = statusCopy({ state: "awaiting-payment", handle: "henry" });
    expect(view.heading).toBe("Awaiting payment");
    expect(view.body).toMatch(/nothing is written to bitcoin/i);
  });

  it("funded — payment seen, archive being written", () => {
    expect(statusCopy({ state: "funded", handle: "henry" }).heading).toBe("Payment received");
  });

  it("inscribed — on chain, registering", () => {
    expect(statusCopy({ state: "inscribed", handle: "henry" }).heading).toBe("On Bitcoin");
  });

  it("done — links to the finished archive by handle", () => {
    expect(statusCopy({ state: "done", handle: "henry" }).body).toContain("/text/henry");
  });

  it("sweeping with a failure reason — states the reason verbatim", () => {
    const view = statusCopy({ state: "sweeping", handle: "henry", failureReason: "underfunded" });
    expect(view.body).toContain("underfunded");
  });

  it("sweeping without a failure reason — still honest, no reason to invent", () => {
    const view = statusCopy({ state: "sweeping", handle: "henry" });
    expect(view.body).not.toContain("undefined");
    expect(view.body).toMatch(/being sent back/i);
  });

  it("swept, expired before any key was ever published — nothing was charged", () => {
    const view = statusCopy({ state: "swept", handle: "henry", failureReason: "expired-before-key" });
    expect(view.heading).toBe("Quote expired");
    expect(view.body).toMatch(/nothing was charged/i);
    expect(view.body).toMatch(/before a payment address/i);
  });

  it("swept with a real failure reason — a refund happened, states why", () => {
    const view = statusCopy({ state: "swept", handle: "henry", failureReason: "broadcast rejected" });
    expect(view.heading).toBe("Payment returned");
    expect(view.body).toContain("broadcast rejected");
  });

  it("swept after a dust residue — honest that no refund was possible, never claims one was sent", () => {
    const view = statusCopy({ state: "swept", handle: "henry", failureReason: "dust" });
    expect(view.body).not.toMatch(/sent back/i);
    expect(view.body).toMatch(/below the miner fee/i);
    expect(view.body).toMatch(/no refund transaction was possible/i);
  });

  it("swept with no failure reason at all — the quote simply expired unpaid", () => {
    const view = statusCopy({ state: "swept", handle: "henry" });
    expect(view.heading).toBe("Quote expired");
    expect(view.body).toMatch(/before payment arrived/i);
  });
});
