import { describe, expect, it } from "vitest";
import { BSM, PrivateKey, Utils } from "@bsv/sdk";
import { parseBindingAddress, registrationMessage, verifyClaim } from "./xBinding";

/** Produce a valid claim the way the app will, with a throwaway key. */
function makeClaim(handle: string, txid: string) {
  const priv = PrivateKey.fromRandom();
  const pub = priv.toPublicKey();
  const address = pub.toAddress();
  const message = registrationMessage(handle, txid);
  const signatureBase64 = BSM.sign(Utils.toArray(message, "utf8"), priv, "base64") as string;
  return { address, pubkeyHex: pub.toString(), signatureBase64, message };
}

describe("registrationMessage", () => {
  it("binds the lowercased handle and the txid, so a signature cannot be replayed", () => {
    expect(registrationMessage("HenryHudson6", "a".repeat(64)))
      .toBe(`henceforth-x-register:henryhudson6:${"a".repeat(64)}`);
  });
});

describe("parseBindingAddress", () => {
  it("extracts the address from the exact binding format", () => {
    const posts = [
      { text: "good morning" },
      { text: "Verifying my Henceforth identity: 1GsP511Tf1xEXAMPLEaddr7WSqc7hCfva — henceforth.club/x" },
    ];
    expect(parseBindingAddress(posts)).toBe("1GsP511Tf1xEXAMPLEaddr7WSqc7hCfva");
  });

  it("returns null when no post carries the binding line", () => {
    expect(parseBindingAddress([{ text: "just a normal tweet about 1coins" }])).toBeNull();
  });

  it("requires the exact prefix — a genuine near-miss is rejected", () => {
    // The words but no colon, so no commitment: a loosened parser would wrongly
    // accept this, so it must return null.
    expect(parseBindingAddress([
      { text: "Verifying my Henceforth identity 1GsP511Tf1xEXAMPLEaddr7WSqc7hCfva" },
    ])).toBeNull();
    // The colon but a different phrase entirely.
    expect(parseBindingAddress([{ text: "my Henceforth identity is great" }])).toBeNull();
  });
});

describe("verifyClaim", () => {
  const handle = "henryhudson6";
  const txid = "b".repeat(64);

  it("accepts a signature by the key that derives to the committed address", () => {
    const c = makeClaim(handle, txid);
    expect(verifyClaim({
      message: registrationMessage(handle, txid),
      signatureBase64: c.signatureBase64,
      pubkeyHex: c.pubkeyHex,
      committedAddress: c.address,
    })).toBe(true);
  });

  it("rejects a signature over a tampered message", () => {
    const c = makeClaim(handle, txid);
    expect(verifyClaim({
      message: registrationMessage("someoneelse", txid),
      signatureBase64: c.signatureBase64,
      pubkeyHex: c.pubkeyHex,
      committedAddress: c.address,
    })).toBe(false);
  });

  it("rejects when the public key does not derive to the committed address", () => {
    const c = makeClaim(handle, txid);
    const other = PrivateKey.fromRandom().toPublicKey();
    expect(verifyClaim({
      message: registrationMessage(handle, txid),
      signatureBase64: c.signatureBase64,
      pubkeyHex: c.pubkeyHex,
      committedAddress: other.toAddress(), // a different address than the signing key's
    })).toBe(false);
  });

  it("rejects a malformed signature without throwing", () => {
    const c = makeClaim(handle, txid);
    expect(verifyClaim({
      message: registrationMessage(handle, txid),
      signatureBase64: "not-base64-!!!",
      pubkeyHex: c.pubkeyHex,
      committedAddress: c.address,
    })).toBe(false);
  });
});
