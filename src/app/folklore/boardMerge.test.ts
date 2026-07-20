import { describe, expect, it } from "vitest";
import { LINK_SCORE_OFFSET, linkMember, profileMember } from "@/lib/folkloreBoard";
import { validateComment, validateLink } from "./linkRecord";
import { linkTxidsOf, mergeBoard, withUnlistedHandles, type LinkResolution } from "./boardMerge";

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

describe("withUnlistedHandles — a paying archiver never loses their card", () => {
  it("renders the directory when the board holds only links", () => {
    // The defect: the front page switched wholesale to the board the moment
    // one paid link existed, and a board of links alone resolved to no
    // profile rows at all — so the first submitted link erased every prior
    // archiver's front-page card.
    const boardRows = mergeBoard(
      [{ member: linkMember(TXID_A), score: LINK_SCORE_OFFSET }],
      [{ handle: "ada", latestMs: 1_000 }],
      resolutions([[TXID_A, { record: LINK, comments: 0 }]]),
    );
    expect(boardRows.map((r) => r.kind)).toEqual(["link"]);

    const rows = withUnlistedHandles(boardRows, [
      { handle: "ada", latestMs: 1_000 },
      { handle: "henry", latestMs: 2_000 },
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["link", "profile", "profile"]);
    expect(rows.flatMap((r) => (r.kind === "profile" ? [r.handle] : []))).toEqual(["ada", "henry"]);
  });

  it("carries a handle that registered after the board was seeded", () => {
    // The other half: the seed was a hand-run script, so anything registering
    // after it last ran was absent from the board permanently.
    const seeded = mergeBoard(
      [{ member: profileMember("ada"), score: 5 }],
      [{ handle: "ada", latestMs: 1_000 }],
      resolutions([]),
    );

    const rows = withUnlistedHandles(seeded, [
      { handle: "ada", latestMs: 1_000 },
      { handle: "latecomer", latestMs: 9_000 },
    ]);
    expect(rows.flatMap((r) => (r.kind === "profile" ? [r.handle] : []))).toEqual([
      "ada",
      "latecomer",
    ]);
  });

  it("never duplicates a handle the board already ranks, whatever the case", () => {
    const seeded = mergeBoard(
      [{ member: profileMember("Ada"), score: 5 }],
      [{ handle: "Ada", latestMs: 1_000 }],
      resolutions([]),
    );
    const rows = withUnlistedHandles(seeded, [{ handle: "ada", latestMs: 1_000 }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "profile", handle: "Ada", score: 5 });
  });

  it("appends beneath the ranking, claiming no standing it has not earned", () => {
    const seeded = mergeBoard(
      [{ member: profileMember("ada"), score: 40 }],
      [{ handle: "ada", latestMs: 1_000 }],
      resolutions([]),
    );
    const rows = withUnlistedHandles(seeded, [
      { handle: "ada", latestMs: 1_000 },
      { handle: "newcomer", latestMs: 2_000 },
    ]);
    expect(rows.map((r) => r.score)).toEqual([40, 0]);
  });

  it("is the identity on an empty directory, and the whole list on an empty board", () => {
    const seeded = mergeBoard([{ member: profileMember("ada"), score: 1 }], [{ handle: "ada", latestMs: 1 }], resolutions([]));
    expect(withUnlistedHandles(seeded, [])).toEqual(seeded);
    expect(withUnlistedHandles([], [{ handle: "ada", latestMs: 1 }])).toEqual([
      { kind: "profile", score: 0, handle: "ada", latestMs: 1 },
    ]);
    expect(withUnlistedHandles([], [])).toEqual([]);
  });
});
