import { describe, expect, it } from "vitest";
import { decryptPdf, encryptPdf } from "./board-pdf-crypto";

const KEY = "a".repeat(64);

describe("board-pdf-crypto", () => {
  it("round-trips bytes", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 fake body");
    const out = decryptPdf(encryptPdf(pdf, KEY), KEY);
    expect(Buffer.from(out).equals(Buffer.from(pdf))).toBe(true);
  });
  it("rejects a tampered payload", () => {
    const payload = Buffer.from(encryptPdf(new TextEncoder().encode("x"), KEY));
    payload[payload.length - 1] ^= 0xff;
    expect(() => decryptPdf(payload, KEY)).toThrow();
  });
  it("rejects the wrong key", () => {
    const payload = encryptPdf(new TextEncoder().encode("x"), KEY);
    expect(() => decryptPdf(payload, "b".repeat(64))).toThrow();
  });
});

import { gzipSync } from "node:zlib";
import { openSealed } from "./board-pdf-crypto";

// The chain envelope seals gzip(bytes) with the same nonce ‖ tag ‖ ciphertext
// layout, so encryptPdf over gzipped bytes is exactly what chain-put-core's
// sealPayload writes.
describe("openSealed", () => {
  const KEY2 = "c".repeat(64);
  it("round-trips a sealed document", () => {
    const doc = new TextEncoder().encode("%PDF-1.7 the morning edition ".repeat(50));
    const sealed = encryptPdf(gzipSync(Buffer.from(doc)), KEY2);
    expect(Buffer.from(openSealed(sealed, KEY2)).equals(Buffer.from(doc))).toBe(true);
  });
  it("fails closed on the wrong key, before decompressing anything", () => {
    const sealed = encryptPdf(gzipSync(Buffer.from("x")), KEY2);
    expect(() => openSealed(sealed, "d".repeat(64))).toThrow();
  });
});
