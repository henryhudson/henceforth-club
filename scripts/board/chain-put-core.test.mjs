import { describe, expect, it } from "vitest";
import {
  INSCRIPTION_MARKER,
  assertHasChange,
  buildEnvelope,
  keyIdentifier,
  openPayload,
  parseEnvelope,
  sealPayload,
} from "./chain-put-core.mjs";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

describe("sealing a document", () => {
  it("round-trips bytes through compression and encryption", () => {
    const doc = Buffer.from("The Morning Edition ".repeat(200));
    const sealed = sealPayload(doc, KEY);
    expect(sealed.length).toBeLessThan(doc.length); // it compressed
    expect(Buffer.from(openPayload(sealed, KEY)).equals(doc)).toBe(true);
  });

  it("fails closed on the wrong key: throws, returns nothing partial", () => {
    const sealed = sealPayload(Buffer.from("private"), KEY);
    expect(() => openPayload(sealed, OTHER)).toThrow();
  });

  it("fails closed on a single touched byte", () => {
    const sealed = sealPayload(Buffer.from("private"), KEY);
    const touched = Buffer.from(sealed);
    touched[touched.length - 1] ^= 0x01;
    expect(() => openPayload(touched, KEY)).toThrow();
  });

  it("refuses a key that is not 32 bytes", () => {
    expect(() => sealPayload(Buffer.from("x"), "abcd")).toThrow(/32 bytes/);
  });

  it("names a key without revealing it", () => {
    expect(keyIdentifier(KEY)).toMatch(/^[0-9a-f]{8}$/);
    expect(keyIdentifier(KEY)).not.toBe(keyIdentifier(OTHER));
    expect(KEY).not.toContain(keyIdentifier(KEY));
  });
});

describe("the envelope", () => {
  const sealed = sealPayload(Buffer.from("doc"), KEY);
  const fields = { surface: "board-report", date: "2026-08-30", keyId: keyIdentifier(KEY), previousTxid: "a".repeat(64), sealed };

  it("round-trips its fields in order, marker first", () => {
    const chunks = buildEnvelope(fields);
    expect(chunks).toHaveLength(6);
    expect(chunks[0].toString("utf8")).toBe(INSCRIPTION_MARKER);
    const back = parseEnvelope(chunks);
    expect(back.surface).toBe("board-report");
    expect(back.date).toBe("2026-08-30");
    expect(back.keyId).toBe(fields.keyId);
    expect(back.previousTxid).toBe("a".repeat(64));
    expect(Buffer.from(openPayload(back.sealed, KEY)).toString()).toBe("doc");
  });

  it("a first inscription carries no previous transaction, and reads back as null", () => {
    const back = parseEnvelope(buildEnvelope({ ...fields, previousTxid: "" }));
    expect(back.previousTxid).toBeNull();
  });

  it("refuses malformed fields rather than inscribing them", () => {
    expect(() => buildEnvelope({ ...fields, surface: "Board Report" })).toThrow(/slug/);
    expect(() => buildEnvelope({ ...fields, date: "30/08/2026" })).toThrow(/YYYY-MM-DD/);
    expect(() => buildEnvelope({ ...fields, keyId: "zz" })).toThrow(/eight hex/);
    expect(() => buildEnvelope({ ...fields, previousTxid: "abc" })).toThrow(/64 lowercase hex/);
  });

  it("does not claim a foreign output as ours", () => {
    expect(parseEnvelope([Buffer.from("somebody-else"), Buffer.from("x")])).toBeNull();
    expect(parseEnvelope(buildEnvelope(fields).slice(0, 5))).toBeNull();
  });
});

describe("the one guard before signing", () => {
  it("refuses a transaction whose only output is data", () => {
    expect(() => assertHasChange([{ change: false, satoshis: 0 }])).toThrow(/only output would be data/);
    expect(() => assertHasChange([{ change: true, satoshis: 0 }])).toThrow();
  });
  it("returns the change output when there is one", () => {
    expect(assertHasChange([{ change: false, satoshis: 0 }, { change: true, satoshis: 9_500 }]).satoshis).toBe(9_500);
  });
});
