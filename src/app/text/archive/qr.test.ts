import { describe, expect, it } from "vitest";
import { qrSvg } from "./qr";
import { bitcoinUri } from "./bitcoinUri";

describe("qrSvg", () => {
  it("is deterministic — the same text always builds the same path", () => {
    const uri = bitcoinUri("1BoatSLRHtKNngkdXEeobR76b53LETtpyT", 9_290_500);
    expect(qrSvg(uri)).toEqual(qrSvg(uri));
  });

  it("produces a non-empty path of only move/line/close commands", () => {
    const { path } = qrSvg(bitcoinUri("1BoatSLRHtKNngkdXEeobR76b53LETtpyT", 9_290_500));
    expect(path.length).toBeGreaterThan(0);
    expect(path).toMatch(/^(M-?\d+(\.\d+)? -?\d+(\.\d+)?h1v1h-1z)+$/);
  });

  it("sizes the viewBox to the module count plus the quiet-zone margin", () => {
    const { size, path } = qrSvg("bitcoin:1BoatSLRHtKNngkdXEeobR76b53LETtpyT?amount=0.092905");
    // Every coordinate in the path must fall within the declared viewBox.
    const coords = [...path.matchAll(/M(-?\d+) (-?\d+)/g)].flatMap((m) => [Number(m[1]), Number(m[2])]);
    expect(coords.length).toBeGreaterThan(0);
    for (const coord of coords) {
      expect(coord).toBeGreaterThanOrEqual(0);
      expect(coord).toBeLessThan(size);
    }
  });

  it("a longer payload never produces a smaller code", () => {
    const short = qrSvg("bitcoin:1BoatSLRHtKNngkdXEeobR76b53LETtpyT?amount=0.01");
    const long = qrSvg(`bitcoin:1BoatSLRHtKNngkdXEeobR76b53LETtpyT?amount=0.01&label=${"x".repeat(200)}`);
    expect(long.size).toBeGreaterThanOrEqual(short.size);
  });
});
