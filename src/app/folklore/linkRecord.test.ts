import { describe, expect, it } from "vitest";
import {
  COMMENT_MAX,
  TITLE_MAX,
  TXID_RE,
  encodeRecord,
  recordFromScripts,
  submitMessage,
  validateComment,
  validateLink,
} from "./linkRecord";

const TXID = "a".repeat(64);

/** UTF-8 bytes of a string. */
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** A PUSHDATA2-prefixed push of `bytes`, as hex — the byte layout
 * `extractPushdata` walks: 0x4d, two-byte little-endian length, data. */
function pushdataHex(bytes: Uint8Array): string {
  const len = bytes.length;
  const header = new Uint8Array([0x4d, len & 0xff, (len >> 8) & 0xff]);
  return [...header, ...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("validateLink and validateComment — total, null on refusal", () => {
  it("accepts an honest link, trimming the title", () => {
    expect(validateLink("https://example.com/a", "  A title  ", "henry")).toEqual({
      v: 1,
      app: "folklore",
      kind: "link",
      url: "https://example.com/a",
      title: "A title",
      by: "henry",
    });
  });

  it("omits `by` entirely when absent", () => {
    const rec = validateLink("https://example.com", "t");
    expect(rec).not.toBeNull();
    expect(rec && "by" in rec).toBe(false);
  });

  it("url scheme: javascript: and ftp: refused, at validate and at parse", () => {
    expect(validateLink("javascript:alert(1)", "t")).toBeNull();
    expect(validateLink("ftp://example.com/f", "t")).toBeNull();
    expect(validateLink("not a url", "t")).toBeNull();
    const hostile = JSON.stringify({
      v: 1,
      app: "folklore",
      kind: "link",
      url: "javascript:alert(1)",
      title: "t",
    });
    expect(recordFromScripts(["6a" + pushdataHex(utf8(hostile))])).toBeNull();
  });

  it("refuses an empty or whitespace-only title", () => {
    expect(validateLink("https://example.com", "")).toBeNull();
    expect(validateLink("https://example.com", "   ")).toBeNull();
  });

  it("comment parent must be a 64-hex txid", () => {
    expect(validateComment("not-a-txid", "hello")).toBeNull();
    expect(validateComment(TXID.slice(0, 63), "hello")).toBeNull();
    expect(validateComment(TXID + "a", "hello")).toBeNull();
    expect(TXID_RE.test(TXID)).toBe(true);
    expect(validateComment(TXID, "hello", "henry")).toEqual({
      v: 1,
      app: "folklore",
      kind: "comment",
      parent: TXID,
      text: "hello",
      by: "henry",
    });
  });
});

describe("caps — enforced at validate AND re-checked at parse", () => {
  it("301-character title refused at validate and at parse", () => {
    expect(validateLink("https://x.com", "t".repeat(TITLE_MAX + 1))).toBeNull();
    expect(validateLink("https://x.com", "t".repeat(TITLE_MAX))).not.toBeNull();
    const hostile = JSON.stringify({
      v: 1,
      app: "folklore",
      kind: "link",
      url: "https://x.com",
      title: "t".repeat(TITLE_MAX + 1),
    });
    expect(recordFromScripts(["6a" + pushdataHex(utf8(hostile))])).toBeNull();
  });

  it("oversized comment refused at validate and at parse", () => {
    expect(validateComment(TXID, "c".repeat(COMMENT_MAX + 1))).toBeNull();
    expect(validateComment(TXID, "c".repeat(COMMENT_MAX))).not.toBeNull();
    const hostile = JSON.stringify({
      v: 1,
      app: "folklore",
      kind: "comment",
      parent: TXID,
      text: "c".repeat(COMMENT_MAX + 1),
    });
    expect(recordFromScripts(["6a" + pushdataHex(utf8(hostile))])).toBeNull();
  });
});

describe("round-trips through script pushdata", () => {
  it("a valid link round-trips", () => {
    const rec = validateLink("https://example.com/a", "A title", "henry");
    expect(rec).not.toBeNull();
    if (!rec) return;
    const hex = "6a" + pushdataHex(encodeRecord(rec)); // OP_RETURN + push
    expect(recordFromScripts([hex])).toEqual(rec);
  });

  it("a valid comment round-trips", () => {
    const rec = validateComment(TXID, "worth reading twice");
    expect(rec).not.toBeNull();
    if (!rec) return;
    const hex = "6a" + pushdataHex(encodeRecord(rec));
    expect(recordFromScripts([hex])).toEqual(rec);
  });

  it("finds the record among several scripts and pushdatas", () => {
    const rec = validateLink("https://example.com", "found me");
    expect(rec).not.toBeNull();
    if (!rec) return;
    const noise = "6a" + pushdataHex(utf8("not json"));
    const hex = "6a" + pushdataHex(utf8("{}")) + pushdataHex(encodeRecord(rec));
    expect(recordFromScripts([noise, hex])).toEqual(rec);
  });
});

describe("hostile chain records are invisible, not errors", () => {
  it("garbage json and a SocialArchive are not records", () => {
    expect(recordFromScripts(["6a" + pushdataHex(utf8("garbage"))])).toBeNull();
    const archive = JSON.stringify({ v: 1, source: "x", handle: "henry", posts: [] });
    expect(recordFromScripts(["6a" + pushdataHex(utf8(archive))])).toBeNull();
  });

  it("wrong version, wrong app, and wrong kinds are not records", () => {
    const wrongV = JSON.stringify({ v: 2, app: "folklore", kind: "link", url: "https://x.com", title: "t" });
    const wrongApp = JSON.stringify({ v: 1, app: "elsewhere", kind: "link", url: "https://x.com", title: "t" });
    const wrongKind = JSON.stringify({ v: 1, app: "folklore", kind: "poll", url: "https://x.com", title: "t" });
    for (const hostile of [wrongV, wrongApp, wrongKind]) {
      expect(recordFromScripts(["6a" + pushdataHex(utf8(hostile))])).toBeNull();
    }
  });

  it("missing fields and wrongly-typed fields are not records", () => {
    const noUrl = JSON.stringify({ v: 1, app: "folklore", kind: "link", title: "t" });
    const numberTitle = JSON.stringify({ v: 1, app: "folklore", kind: "link", url: "https://x.com", title: 7 });
    const noText = JSON.stringify({ v: 1, app: "folklore", kind: "comment", parent: TXID });
    for (const hostile of [noUrl, numberTitle, noText, "null", "7", '"folklore"']) {
      expect(recordFromScripts(["6a" + pushdataHex(utf8(hostile))])).toBeNull();
    }
  });

  it("an empty script list is not a record", () => {
    expect(recordFromScripts([])).toBeNull();
  });
});

describe("submitMessage — what a bound submitter signs", () => {
  it("commits to the exact bytes that will be inscribed", () => {
    const link = validateLink("https://example.com/a", "A title", "henry");
    if (!link) throw new Error("fixture must validate");
    expect(submitMessage(link)).toBe(
      `henceforth-folklore-submit:${new TextDecoder().decode(encodeRecord(link))}`,
    );
  });

  it("changes with every field, so a signature cannot be lifted onto another submission", () => {
    const base = validateLink("https://example.com/a", "A title", "henry");
    const otherUrl = validateLink("https://example.com/b", "A title", "henry");
    const otherTitle = validateLink("https://example.com/a", "Another title", "henry");
    const otherBy = validateLink("https://example.com/a", "A title", "mallory");
    const anonymous = validateLink("https://example.com/a", "A title");
    if (!base || !otherUrl || !otherTitle || !otherBy || !anonymous) {
      throw new Error("fixtures must validate");
    }
    const messages = [base, otherUrl, otherTitle, otherBy, anonymous].map(submitMessage);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("is namespaced away from the registration claim", () => {
    const comment = validateComment("ab".repeat(32), "well said", "henry");
    if (!comment) throw new Error("fixture must validate");
    expect(submitMessage(comment).startsWith("henceforth-folklore-submit:")).toBe(true);
    expect(submitMessage(comment).includes("henceforth-x-register:")).toBe(false);
  });
});
