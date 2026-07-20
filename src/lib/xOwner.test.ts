import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimOutcome, readOwner, sameBoundIdentity, type XOwner } from "./xOwner";

const owner = (address: string): XOwner => ({
  address, pubkey: "02".padEnd(66, "a"), boundAt: 1, bindingTxid: "c".repeat(64), bindingPostId: "1",
});

// The store the two Redis-backed readers see. `null` is an unconfigured
// store, which must read as unavailable rather than as "nobody owns this".
let owners: Map<string, XOwner> | null = new Map();

vi.mock("./redis", () => ({
  getRedis: () =>
    owners === null
      ? null
      : { get: async (key: string) => owners?.get(key) ?? null },
}));

beforeEach(() => {
  owners = new Map();
});

const bind = (handle: string, address: string) =>
  owners?.set(`x:owner:${handle.toLowerCase()}`, owner(address));

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

describe("readOwner keeps an outage distinct from an absence", () => {
  it("answers with the owner of a bound handle, case-blind", async () => {
    bind("henry", "1AAA");
    expect(await readOwner("Henry")).toEqual({ kind: "owner", owner: owner("1AAA") });
  });

  it("answers absent for a handle nobody has bound", async () => {
    expect(await readOwner("stranger")).toEqual({ kind: "absent" });
  });

  it("answers unavailable without a store — never absent", async () => {
    // The refusal a submit path relays: "not bound, do not retry" would be a
    // lie during an outage, and the caller can only tell the two apart if
    // this one does.
    owners = null;
    expect(await readOwner("henry")).toEqual({ kind: "unavailable" });
  });
});

describe("sameBoundIdentity — one person under two names", () => {
  it("is true for two handles bound to one identity address", async () => {
    bind("alice", "1AAA");
    bind("alice_alt", "1AAA");
    expect(await sameBoundIdentity("alice", "alice_alt")).toBe(true);
  });

  it("is true for the same handle whatever the case", async () => {
    expect(await sameBoundIdentity("alice", "Alice")).toBe(true);
  });

  it("is false for two handles bound to different addresses", async () => {
    bind("alice", "1AAA");
    bind("ben", "1BBB");
    expect(await sameBoundIdentity("alice", "ben")).toBe(false);
  });

  it("is false when either side is unbound — unprovable is never a refusal", async () => {
    bind("alice", "1AAA");
    expect(await sameBoundIdentity("alice", "stranger")).toBe(false);
    expect(await sameBoundIdentity("stranger", "alice")).toBe(false);
    expect(await sameBoundIdentity("nobody", "stranger")).toBe(false);
  });

  it("is false without a store — an outage must not refuse an honest tip", async () => {
    owners = null;
    expect(await sameBoundIdentity("alice", "ben")).toBe(false);
  });
});
