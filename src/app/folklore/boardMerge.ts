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
