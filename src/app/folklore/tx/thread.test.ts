import { describe, expect, it } from "vitest";
import { validateComment, validateLink } from "../linkRecord";
import { assembleThread } from "./thread";

const PARENT = "a".repeat(64);
const OTHER = "b".repeat(64);
const TX_1 = "1".repeat(64);
const TX_2 = "2".repeat(64);
const TX_3 = "3".repeat(64);

const comment = (parent: string, text: string, by?: string) => {
  const rec = validateComment(parent, text, by);
  if (!rec) throw new Error("fixture comment must validate");
  return rec;
};

describe("assembleThread", () => {
  it("keeps the fetched list order — chronological, the index list order IS submission order", () => {
    const thread = assembleThread(PARENT, [
      { txid: TX_1, record: comment(PARENT, "first", "henry") },
      { txid: TX_2, record: comment(PARENT, "second") },
      { txid: TX_3, record: comment(PARENT, "third", "ada") },
    ]);

    expect(thread).toEqual([
      { txid: TX_1, text: "first", by: "henry" },
      { txid: TX_2, text: "second" },
      { txid: TX_3, text: "third", by: "ada" },
    ]);
  });

  it("skips hostile records silently — garbage bytes and a link riding a comment txid", () => {
    const link = validateLink("https://example.com/a", "not a comment");
    if (!link) throw new Error("fixture link must validate");

    const thread = assembleThread(PARENT, [
      { txid: TX_1, record: null }, // unparseable or delisted — invisible, not an error
      { txid: TX_2, record: link },
      { txid: TX_3, record: comment(PARENT, "the only honest one") },
    ]);

    expect(thread).toEqual([{ txid: TX_3, text: "the only honest one" }]);
  });

  it("renders a comment nowhere but under its own parent — an orphan appears on no page", () => {
    const stray = comment(OTHER, "addressed to a different transaction");

    expect(assembleThread(PARENT, [{ txid: TX_1, record: stray }])).toEqual([]);
    expect(assembleThread(PARENT.toUpperCase(), [{ txid: TX_2, record: comment(PARENT, "case-blind") }]))
      .toEqual([{ txid: TX_2, text: "case-blind" }]);
  });

  it("assembles the empty thread from an empty fetch", () => {
    expect(assembleThread(PARENT, [])).toEqual([]);
  });
});
