import { LINK_SCORE_OFFSET } from "@/lib/folkloreBoard";
import type { FolkloreLink, FolkloreRecord } from "./linkRecord";

// The pure half of the unified board: resolve the `folklore:board` members
// against already-loaded data, preserving the zset's kudos order. A member
// that resolves to nothing — an unknown handle, a delisted link cache, a
// cached record that is not a link, an encoding this code doesn't know — is
// dropped silently: that absence IS the moderation lever (spec §7), and a
// hostile board entry must be invisible, never an error.

const PROFILE_PREFIX = "profile:";
const LINK_PREFIX = "link:";

export type HandleCard = { handle: string; latestMs: number };
export type LinkResolution = { record: FolkloreRecord; comments: number };

export type BoardRow =
  | { kind: "profile"; score: number; handle: string; latestMs: number }
  | { kind: "link"; score: number; txid: string; record: FolkloreLink; comments: number };

/** The txids the board's link members point at, in board order — what the
 * page must resolve through the record cache before merging. */
export const linkTxidsOf = (entries: { member: string }[]): string[] =>
  entries
    .filter((e) => e.member.startsWith(LINK_PREFIX))
    .map((e) => e.member.slice(LINK_PREFIX.length));

/**
 * Pure. The handles the board ranks as profiles that the directory read did
 * not supply a card for — what the page must look up before merging, the
 * profile-side twin of `linkTxidsOf`.
 *
 * The two windows are drawn from different sorted sets and ordered by
 * different quantities: `x:handles` is scored by registration time, so its
 * window is the most recently REGISTERED handles, while `folklore:board` is
 * scored by kudos, so its window is the highest-SCORING members. Equal window
 * sizes therefore do not make the two sets equal, and the difference falls on
 * the archivers who registered earliest and earned most — exactly the people
 * with the most standing to lose. mergeBoard can only render a member whose
 * card it was handed, so an unlooked-up veteran renders NOWHERE: not demoted,
 * absent. Every archive on that board was paid for, so that is a payer losing
 * a delivered artifact, the same harm the directory rescue closed.
 *
 * Lower-cased and de-duplicated because the result is a Redis read, and the
 * directory's members are lower-cased handles.
 */
export const unresolvedProfileHandles = (
  entries: { member: string }[],
  handleCards: HandleCard[],
): string[] => {
  const listed = new Set(handleCards.map((card) => card.handle.toLowerCase()));
  return [
    ...new Set(
      entries.flatMap((e) =>
        e.member.startsWith(PROFILE_PREFIX)
          ? [e.member.slice(PROFILE_PREFIX.length).toLowerCase()]
          : [],
      ),
    ),
  ].filter((handle) => !listed.has(handle));
};

/**
 * Pure. Every directory handle the board did not account for, appended after
 * the board's own rows in the directory's order.
 *
 * The board is an opinion about the chain (spec Decision 2), and an opinion
 * can be incomplete: a handle registered before the board existed, one whose
 * seed never ran, one below `boardTop`'s window. The page must not treat "one
 * link exists" as "the board is authoritative" — that reading made the first
 * paid link erase the whole handle-only directory, and every archiver who had
 * paid for a front-page card lost it in the same instant.
 *
 * Appended rather than merged into the ranking, and at score zero: these
 * handles have no board standing to claim, so they sit under everything that
 * does, in whatever order the directory itself chose.
 */
export function withUnlistedHandles(rows: BoardRow[], handleCards: HandleCard[]): BoardRow[] {
  // The invariant is one PROFILE card per handle, so the set is built from
  // profile rows and dedupes against profile rows only. A link row naming the
  // same handle in its `by` is not a second card for that archiver: spec §4
  // gives an archive and a link two different card kinds, and both were paid
  // for separately. Suppressing either because the other exists would delete
  // something a payer bought.
  const listed = new Set(
    rows.flatMap((row) => (row.kind === "profile" ? [row.handle.toLowerCase()] : [])),
  );
  return [
    ...rows,
    ...handleCards
      .filter((card) => !listed.has(card.handle.toLowerCase()))
      .map((card): BoardRow => ({
        kind: "profile",
        score: 0,
        handle: card.handle,
        latestMs: card.latestMs,
      })),
  ];
}

/** Pure. One board, one ranking: each member becomes a row against the data
 * the page loaded, in the score order `boardTop` already established.
 *
 * A link row's `score` is its honest kudos count, not its raw board score:
 * LINK_SCORE_OFFSET is the half-kudos a link carries purely to defeat the
 * zset's equal-score member tie-break, and it is dropped here — the ordering
 * was decided upstream, so subtracting it costs nothing and keeps the card
 * from ever rendering "0.5 kudos". */
export function mergeBoard(
  entries: { member: string; score: number }[],
  handleCards: HandleCard[],
  linkRecords: ReadonlyMap<string, LinkResolution>,
): BoardRow[] {
  const byHandle = new Map(handleCards.map((card) => [card.handle.toLowerCase(), card]));
  return entries.flatMap(({ member, score }): BoardRow[] => {
    if (member.startsWith(PROFILE_PREFIX)) {
      const card = byHandle.get(member.slice(PROFILE_PREFIX.length).toLowerCase());
      return card ? [{ kind: "profile", score, handle: card.handle, latestMs: card.latestMs }] : [];
    }
    if (member.startsWith(LINK_PREFIX)) {
      const txid = member.slice(LINK_PREFIX.length);
      const hit = linkRecords.get(txid);
      return hit && hit.record.kind === "link"
        ? [
            {
              kind: "link",
              score: score - LINK_SCORE_OFFSET,
              txid,
              record: hit.record,
              comments: hit.comments,
            },
          ]
        : [];
    }
    return [];
  });
}
