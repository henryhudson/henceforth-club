import { describe, expect, it } from "vitest";
import { COMMENT_MAX, TITLE_MAX } from "../linkRecord";
import { draftRequest } from "./submitDraft";

const TXID = "a".repeat(64);
const TARGET = "ab".repeat(32);

describe("draftRequest — a target to list", () => {
  it("produces the validated target and title, trimmed and lowercased", () => {
    const result = draftRequest({
      kind: "link",
      target: `  ${TARGET.toUpperCase()}  `,
      title: "  A story worth keeping  ",
    });
    expect(result).toEqual({
      ok: true,
      body: { kind: "link", target: TARGET, title: "A story worth keeping" },
    });
  });

  it("takes the id out of a link that contains one — an explorer, Twetch or Treechat page", () => {
    for (const paste of [
      `https://whatsonchain.com/tx/${TARGET}`,
      `https://treechat.com/t/${TARGET}`,
      `https://www.henceforth.club/folklore/tx/${TARGET}`,
    ]) {
      const result = draftRequest({ kind: "link", target: paste, title: "t" });
      expect(result).toEqual({ ok: true, body: { kind: "link", target: TARGET, title: "t" } });
    }
  });

  it("refuses an empty title before the paste is even judged", () => {
    const result = draftRequest({ kind: "link", target: "not an id", title: "   " });
    expect(result).toEqual({ ok: false, message: "Give the link a title." });
  });

  it("refuses a title over the cap and names the overage", () => {
    const result = draftRequest({
      kind: "link",
      target: TARGET,
      title: "x".repeat(TITLE_MAX + 12),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("12 over");
  });

  it("accepts a title exactly at the cap", () => {
    const result = draftRequest({ kind: "link", target: TARGET, title: "x".repeat(TITLE_MAX) });
    expect(result.ok).toBe(true);
  });

  it("refuses a paste with no transaction id in it — a web address is not a target", () => {
    for (const paste of ["https://example.com/story", "ftp://example.com/file", "just words", "abc"]) {
      const result = draftRequest({ kind: "link", target: paste, title: "t" });
      expect(result).toEqual({
        ok: false,
        message: "Paste a transaction id — 64 hex characters, or a link that contains one.",
      });
    }
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
