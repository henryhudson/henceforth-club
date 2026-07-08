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
