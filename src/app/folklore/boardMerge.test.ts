import { describe, expect, it } from "vitest";
import { LINK_SCORE_OFFSET, linkMember, profileMember } from "@/lib/folkloreBoard";
import { validateComment, validateLink } from "./linkRecord";
import { linkTxidsOf, mergeBoard, type LinkResolution } from "./boardMerge";

const TXID_A = "a".repeat(64);
const TXID_B = "b".repeat(64);

const LINK = validateLink("https://example.com/a", "A title", "henry");
if (!LINK) throw new Error("fixture link must validate");

const resolutions = (pairs: [string, LinkResolution][]) => new Map(pairs);

describe("mergeBoard", () => {
  it("preserves the board's score order across mixed members", () => {
    const rows = mergeBoard(
      [
        { member: profileMember("henry"), score: 12 },
        { member: linkMember(TXID_A), score: 7 + LINK_SCORE_OFFSET },
        { member: profileMember("ada"), score: 3 },
      ],
      [
        { handle: "ada", latestMs: 1_000 },
        { handle: "henry", latestMs: 2_000 },
      ],
      resolutions([[TXID_A, { record: LINK, comments: 2 }]]),
    );

    expect(rows.map((r) => r.kind)).toEqual(["profile", "link", "profile"]);
    // The link's tie-break offset is dropped: 7.5 on the board is 7 kudos.
    expect(rows.map((r) => r.score)).toEqual([12, 7, 3]);
  });

  it("renders a freshly-entered link as zero kudos, never half of one", () => {
    const rows = mergeBoard(
      [{ member: linkMember(TXID_A), score: LINK_SCORE_OFFSET }],
      [],
      resolutions([[TXID_A, { record: LINK, comments: 0 }]]),
    );

    expect(rows.map((r) => r.score)).toEqual([0]);
  });

  it("resolves a profile member to its handle card, case-blind", () => {
    const rows = mergeBoard(
      [{ member: profileMember("Henry"), score: 5 }],
      [{ handle: "henry", latestMs: 4_200 }],
      resolutions([]),
    );

    expect(rows).toEqual([{ kind: "profile", score: 5, handle: "henry", latestMs: 4_200 }]);
  });

  it("resolves a link member to its record and comment count", () => {
    const rows = mergeBoard(
      [{ member: linkMember(TXID_A), score: 9 + LINK_SCORE_OFFSET }],
      [],
      resolutions([[TXID_A, { record: LINK, comments: 3 }]]),
    );

    expect(rows).toEqual([{ kind: "link", score: 9, txid: TXID_A, record: LINK, comments: 3 }]);
  });

  it("drops unresolvable members silently — the moderation lever", () => {
    const comment = validateComment(TXID_B, "not a link");
    if (!comment) throw new Error("fixture comment must validate");

    const rows = mergeBoard(
      [
        { member: profileMember("ghost"), score: 8 }, // unknown handle
        { member: linkMember(TXID_B), score: 6 }, // delisted: no cached record
        { member: linkMember(TXID_A), score: 4 }, // cached record is not a link
        { member: "garbage-member", score: 2 }, // unknown encoding
      ],
      [{ handle: "henry", latestMs: 1_000 }],
      resolutions([[TXID_A, { record: comment, comments: 0 }]]),
    );

    expect(rows).toEqual([]);
  });
});

describe("linkTxidsOf", () => {
  it("extracts only the link txids, in board order", () => {
    const txids = linkTxidsOf([
      { member: profileMember("henry") },
      { member: linkMember(TXID_A) },
      { member: linkMember(TXID_B) },
    ]);

    expect(txids).toEqual([TXID_A, TXID_B]);
  });
});
