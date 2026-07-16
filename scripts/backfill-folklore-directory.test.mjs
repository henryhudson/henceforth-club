import { describe, it, expect } from "vitest";
import { handleFromKey, isValidTxidList, scanCandidateHandles } from "./backfill-folklore-directory.mjs";

const TXID_A = "a".repeat(64);
const TXID_B = "b".repeat(64);

describe("handleFromKey", () => {
  it("reads the handle from a bare per-handle key", () => {
    expect(handleFromKey("x:henryhudson6")).toBe("henryhudson6");
  });

  it("cannot tell x:handles apart from a real per-handle key by shape alone — 'handles' is itself a valid handle suffix", () => {
    expect(handleFromKey("x:handles")).toBe("handles");
  });

  it("rejects every other key family sharing the x: prefix, all of which carry a further colon", () => {
    expect(handleFromKey("x:job:1234")).toBeNull();
    expect(handleFromKey("x:score:henryhudson6")).toBeNull();
    expect(handleFromKey("x:vote:tx:" + TXID_A)).toBeNull();
    expect(handleFromKey("x:ledger:henryhudson6")).toBeNull();
    expect(handleFromKey("x:owner:henryhudson6")).toBeNull();
    expect(handleFromKey("x:txdigest:" + TXID_A)).toBeNull();
  });

  it("rejects keys outside the x: namespace and handles longer than X allows", () => {
    expect(handleFromKey("board:latest")).toBeNull();
    expect(handleFromKey("x:" + "a".repeat(16))).toBeNull();
  });
});

describe("isValidTxidList", () => {
  it("accepts a single legacy string txid, or a non-empty array of them", () => {
    expect(isValidTxidList(TXID_A)).toBe(true);
    expect(isValidTxidList([TXID_A, TXID_B])).toBe(true);
  });

  it("rejects anything that isn't a real txid list — including the shape a sorted set would surface as", () => {
    expect(isValidTxidList([])).toBe(false);
    expect(isValidTxidList(42)).toBe(false);
    expect(isValidTxidList(null)).toBe(false);
    expect(isValidTxidList(["not-a-txid"])).toBe(false);
  });
});

describe("scanCandidateHandles", () => {
  it("accepts only genuine per-handle entries from a seeded scan carrying one of each impostor key", async () => {
    // Mirrors real Redis: GET on a key holding a different type (x:handles is
    // a sorted set) throws WRONGTYPE — the trap the suffix regex alone can't
    // catch, since "handles" is itself a well-formed handle shape.
    const store = {
      "x:henryhudson6": [TXID_A, TXID_B],
      "x:alice": TXID_A, // legacy single-string shape
      "x:handles": { __wrongType: true },
      "x:job:1234": "irrelevant",
      "x:score:henryhudson6": "irrelevant",
      ["x:vote:tx:" + TXID_A]: "1",
      "x:ledger:henryhudson6": [],
      "x:owner:henryhudson6": { address: "1abc" },
    };
    const redis = {
      scan: async () => ["0", Object.keys(store)],
      get: async (key) => {
        const value = store[key];
        if (value && typeof value === "object" && value.__wrongType) {
          throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
        }
        return value ?? null;
      },
    };

    const candidates = await scanCandidateHandles(redis);

    expect(candidates).toEqual([
      { handle: "henryhudson6", latestTxid: TXID_B },
      { handle: "alice", latestTxid: TXID_A },
    ]);
  });

  it("pages through scan cursors until Redis reports done", async () => {
    const store = { "x:alice": TXID_A, "x:bob": TXID_B };
    const calls = [];
    const redis = {
      scan: async (cursor) => {
        calls.push(cursor);
        return cursor === "0" ? ["1", ["x:alice"]] : ["0", ["x:bob"]];
      },
      get: async (key) => store[key] ?? null,
    };

    const candidates = await scanCandidateHandles(redis);

    expect(calls).toEqual(["0", "1"]);
    expect(candidates.map((c) => c.handle).sort()).toEqual(["alice", "bob"]);
  });
});
