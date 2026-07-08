import { describe, expect, it } from "vitest";
import { isInscribable, onChain, portable, type Inscribable } from "./source";
import type { XArchive } from "./parseArchive";

const archive: XArchive = { profile: { handle: "someone" }, posts: [] };
const TXID = "f".repeat(64);

describe("archive sources", () => {
  it("an archive the visitor exported is inscribable", () => {
    expect(isInscribable(portable(archive))).toBe(true);
  });

  it("an archive read from the chain is not", () => {
    expect(isInscribable(onChain(archive, TXID))).toBe(false);
  });

  it("an archive read from the chain cannot even be TYPED as inscribable", () => {
    // @ts-expect-error OnChain must never satisfy Inscribable. If this line ever
    // compiles, the boundary between looking and keeping has been erased.
    const impossible: Inscribable = onChain(archive, TXID);
    expect(impossible.kind).toBe("onchain");
  });

  it("carries the transaction id only on the chain-read side", () => {
    expect(onChain(archive, TXID).txid).toBe(TXID);
  });
});
