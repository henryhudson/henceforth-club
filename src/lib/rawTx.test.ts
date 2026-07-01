import { describe, it, expect } from "vitest";
import { voutScriptsFromRawTx } from "./rawTx";

// Build a minimal raw transaction: version 1, one input (null prevout, empty
// script), the given output scripts, locktime 0. Exercises the real wire format.
function rawTx(outputScriptsHex: string[]): string {
  const varint = (n: number): string => {
    if (n < 0xfd) return n.toString(16).padStart(2, "0");
    if (n <= 0xffff) {
      const le = [n & 0xff, (n >> 8) & 0xff];
      return "fd" + le.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const le = [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
    return "fe" + le.map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  const version = "01000000";
  const input = "00".repeat(32) + "ffffffff" + varint(0) + "ffffffff";
  const outputs = outputScriptsHex
    .map((s) => "0100000000000000" + varint(s.length / 2) + s)
    .join("");
  return version + varint(1) + input + varint(outputScriptsHex.length) + outputs + "00000000";
}

describe("voutScriptsFromRawTx", () => {
  it("extracts every output script from a raw transaction", () => {
    const opReturn = "006a04" + "74657374"; // OP_FALSE OP_RETURN push4 "test"
    const p2pkh = "76a914" + "11".repeat(20) + "88ac";
    expect(voutScriptsFromRawTx(rawTx([opReturn, p2pkh]))).toEqual([opReturn, p2pkh]);
  });

  it("handles a script large enough to need a multi-byte length varint", () => {
    // ~70,000-byte pushdata script — beyond the single-byte and 0xfd(2-byte)
    // boundaries WhatsOnChain's JSON endpoint truncates around.
    const bigData = "ab".repeat(70_000);
    const lenLe = (70_000).toString(16).padStart(8, "0").match(/../g)?.reverse().join("");
    const bigScript = "006a" + "4e" + lenLe + bigData; // OP_FALSE OP_RETURN PUSHDATA4
    const scripts = voutScriptsFromRawTx(rawTx([bigScript]));
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toBe(bigScript);
  });

  it("returns [] for truncated or garbage input rather than throwing", () => {
    expect(voutScriptsFromRawTx("01000000ff")).toEqual([]);
    expect(voutScriptsFromRawTx("not hex at all")).toEqual([]);
  });
});
