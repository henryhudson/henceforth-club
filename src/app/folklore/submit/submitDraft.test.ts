import { describe, expect, it } from "vitest";
import { COMMENT_MAX, TITLE_MAX } from "../linkRecord";
import { draftRequest } from "./submitDraft";

const TXID = "a".repeat(64);

describe("draftRequest — link", () => {
  it("produces the exact route body, trimmed", () => {
    const result = draftRequest({
      kind: "link",
      url: "  https://example.com/story  ",
      title: "  A story worth keeping  ",
    });
    expect(result).toEqual({
      ok: true,
      body: { kind: "link", url: "https://example.com/story", title: "A story worth keeping" },
    });
  });

  it("refuses an empty title before the url is even judged", () => {
    const result = draftRequest({ kind: "link", url: "not a url", title: "   " });
    expect(result).toEqual({ ok: false, message: "Give the link a title." });
  });

  it("refuses a title over the cap and names the overage", () => {
    const result = draftRequest({
      kind: "link",
      url: "https://example.com",
      title: "x".repeat(TITLE_MAX + 12),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("12 over");
  });

  it("accepts a title exactly at the cap", () => {
    const result = draftRequest({
      kind: "link",
      url: "https://example.com",
      title: "x".repeat(TITLE_MAX),
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a non-http scheme", () => {
    const result = draftRequest({ kind: "link", url: "ftp://example.com/file", title: "t" });
    expect(result).toEqual({ ok: false, message: "The link must be an http or https address." });
  });

  it("refuses something that is not a url at all", () => {
    const result = draftRequest({ kind: "link", url: "just words", title: "t" });
    expect(result.ok).toBe(false);
  });
});

describe("draftRequest — comment", () => {
  it("produces the exact route body, trimmed", () => {
    const result = draftRequest({ kind: "comment", parent: ` ${TXID} `, text: " well said " });
    expect(result).toEqual({
      ok: true,
      body: { kind: "comment", parent: TXID, text: "well said" },
    });
  });

  it("refuses a parent that is not a 64-character transaction id", () => {
    for (const parent of ["", "abc", "g".repeat(64), "a".repeat(63)]) {
      const result = draftRequest({ kind: "comment", parent, text: "hello" });
      expect(result).toEqual({
        ok: false,
        message: "The parent must be the link's 64-character transaction id.",
      });
    }
  });

  it("refuses an empty comment", () => {
    const result = draftRequest({ kind: "comment", parent: TXID, text: "  " });
    expect(result).toEqual({ ok: false, message: "Write the comment first." });
  });

  it("refuses a comment over the cap and names the overage with separators", () => {
    const result = draftRequest({
      kind: "comment",
      parent: TXID,
      text: "x".repeat(COMMENT_MAX + 1_500),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("10,000 characters");
      expect(result.message).toContain("1,500 over");
    }
  });

  it("accepts a comment exactly at the cap", () => {
    const result = draftRequest({ kind: "comment", parent: TXID, text: "x".repeat(COMMENT_MAX) });
    expect(result.ok).toBe(true);
  });
});
