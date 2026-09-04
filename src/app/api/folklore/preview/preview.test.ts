import { describe, expect, it } from "vitest";
import { TITLE_MAX, validateLink } from "@/app/folklore/linkRecord";
import type { SocialArchive } from "@/app/folklore/onchain";
import type { XPost } from "@/app/folklore/parseArchive";
import { defaultTitle, previewFor } from "./preview";

const TXID = "ab".repeat(32);
const OTHER = "cd".repeat(32);

const post = (text: string): XPost => ({ id: TXID, at: "", text, txid: TXID });
const archive = (posts: Array<{ text: string }>): SocialArchive => ({
  source: "x",
  handle: "henry",
  profile: {},
  posts: posts.map((p, i) => ({ id: String(i), at: "", text: p.text })),
});

describe("defaultTitle", () => {
  it("is the first non-empty line, trimmed", () => {
    expect(defaultTitle("  \n\n  A cello note  \nsecond line")).toBe("A cello note");
    expect(defaultTitle("one\r\ntwo")).toBe("one");
  });

  it("clips at the title cap", () => {
    expect(defaultTitle("x".repeat(TITLE_MAX + 40))).toBe("x".repeat(TITLE_MAX));
  });

  it("is undefined when there is no line to take", () => {
    expect(defaultTitle("")).toBeUndefined();
    expect(defaultTitle("   \n\t\n")).toBeUndefined();
  });
});

describe("previewFor", () => {
  it("chips a Magic Attribute Protocol post by its app and titles it by its first line", () => {
    expect(
      previewFor({ kind: "map", post: post("hello\nworld"), source: "twetch" }, TXID, false),
    ).toEqual({
      txid: TXID,
      kind: "map",
      source: "twetch",
      title: "hello",
      listed: false,
    });
  });

  it("leaves the title absent, never empty, when a post has no text", () => {
    const preview = previewFor({ kind: "map", post: post("   "), source: "treechat" }, TXID, false);
    expect(preview).toEqual({ txid: TXID, kind: "map", source: "treechat", listed: false });
    expect("title" in preview).toBe(false);
  });

  it("chips an archive by its source and titles it by its first post", () => {
    expect(
      previewFor({ kind: "archive", archive: archive([{ text: "first" }, { text: "second" }]) }, TXID, false),
    ).toEqual({
      txid: TXID,
      kind: "archive",
      source: "x",
      title: "first",
      listed: false,
    });
    expect(previewFor({ kind: "archive", archive: archive([]) }, TXID, false)).toEqual({
      txid: TXID,
      kind: "archive",
      source: "x",
      listed: false,
    });
  });

  it("titles a legacy link by its own title", () => {
    const record = validateLink("https://example.com/a", "A titled link");
    if (!record) throw new Error("expected record");
    expect(previewFor({ kind: "legacy-link", record }, TXID, false)).toEqual({
      txid: TXID,
      kind: "legacy-link",
      source: "folklore",
      title: "A titled link",
      listed: false,
    });
  });

  it("points a comment at its parent and a stamp at its target — the id to list instead", () => {
    expect(previewFor({ kind: "comment", parent: OTHER }, TXID, false)).toEqual({
      txid: TXID,
      kind: "comment",
      listInstead: OTHER,
      listed: false,
    });
    expect(previewFor({ kind: "stamp", target: OTHER }, TXID, false)).toEqual({
      txid: TXID,
      kind: "stamp",
      listInstead: OTHER,
      listed: false,
    });
  });

  it("keeps an opaque transaction listable, with nothing to chip or title", () => {
    expect(previewFor({ kind: "opaque" }, TXID, false)).toEqual({
      txid: TXID,
      kind: "opaque",
      listed: false,
    });
  });

  it("carries the board's verdict untouched, whatever the id turns out to be", () => {
    expect(previewFor({ kind: "opaque" }, TXID, true).listed).toBe(true);
    expect(previewFor({ kind: "stamp", target: OTHER }, TXID, true).listed).toBe(true);
  });
});
