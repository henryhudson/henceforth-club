import { describe, it, expect } from "vitest";
import { payAndReserve, resourcesForPosts, type GateDeps } from "./xGate";

const TXID = "f".repeat(64);

/** Records the ORDER of the gate's side effects — the order IS the contract. */
function deps(overrides: Partial<GateDeps> = {}) {
  const calls: string[] = [];
  const base = {
    price: async () => ({ ok: true, bsvUsd: 50 }),
    verify: async () => {
      calls.push("verify");
      return { ok: true, sats: 999_999_999 };
    },
    reserve: async () => {
      calls.push("reserve");
      return { ok: true, reservedUsd: 1 };
    },
    release: async () => {
      calls.push("release");
    },
    consume: async () => {
      calls.push("burn");
      return { ok: true };
    },
    ...overrides,
  } as unknown as GateDeps;
  return { deps: base, calls };
}

describe("payAndReserve — the order is the contract", () => {
  it("verifies, THEN reserves, THEN burns", async () => {
    const { deps: d, calls } = deps();
    const gate = await payAndReserve(TXID, resourcesForPosts(100), d);
    expect(gate.ok).toBe(true);
    expect(calls).toEqual(["verify", "reserve", "burn"]);
  });

  it("an exhausted budget refuses WITHOUT burning the payment", async () => {
    // The 2026-07-12 regression this pins: the gate burned FIRST, so a caller
    // whose read exceeded the day's ceiling paid a real on-chain fee and received
    // nothing — the money destroyed, not merely stranded. A whole-profile archive
    // (1,647 posts, $8.24 of X spend) against a $6 daily budget hits exactly this.
    const { deps: d, calls } = deps({
      reserve: (async () => ({ ok: false, reason: "budget-exhausted" })) as GateDeps["reserve"],
    });
    const gate = await payAndReserve(TXID, resourcesForPosts(1647), d);
    expect(gate.ok).toBe(false);
    expect(calls).not.toContain("burn");
  });

  it("an underpaid fee is refused before either the reservation or the burn", async () => {
    const { deps: d, calls } = deps({
      verify: (async () => {
        calls.push("verify");
        return { ok: false, reason: "underpaid" };
      }) as unknown as GateDeps["verify"],
    });
    const gate = await payAndReserve(TXID, resourcesForPosts(100), d);
    expect(gate.ok).toBe(false);
    expect(calls).toEqual(["verify"]); // nothing reserved, nothing burned
  });

  it("hands the reservation back when the burn fails — no budget held for a read that will not happen", async () => {
    const { deps: d, calls } = deps({
      consume: (async () => {
        calls.push("burn");
        return { ok: false, reason: "replayed" };
      }) as unknown as GateDeps["consume"],
    });
    const gate = await payAndReserve(TXID, resourcesForPosts(100), d);
    expect(gate.ok).toBe(false);
    expect(calls).toEqual(["verify", "reserve", "burn", "release"]);
  });

  it("still refuses a replayed payment — reserving first does not let one fee buy two reads", async () => {
    const { deps: d } = deps({
      consume: (async () => ({ ok: false, reason: "replayed" })) as unknown as GateDeps["consume"],
    });
    const gate = await payAndReserve(TXID, resourcesForPosts(100), d);
    expect(gate.ok).toBe(false);
  });
});
