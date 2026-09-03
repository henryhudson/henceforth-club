import { dateKey } from "@/lib/redis";
import { listHandles } from "@/lib/xIndex";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";
import { boardTop, readLinkRecord } from "@/lib/folkloreBoard";
import { linkTxidsOf } from "@/app/folklore/boardMerge";
import type { XPost } from "@/app/folklore/parseArchive";
import { readTipPriorities } from "@/lib/kudos/tips";
import { authorRatings, type RatingTable } from "./elo";
import { readRatingTable } from "./ledger";
import type { DealCandidate } from "./dealer";

// The dealer's candidate pool — which posts can be put on the table at all.
// Two sources, in this order: each registered handle's first archive page
// (its most recent PAGE_SIZE posts, so the pool tracks what the showroom
// itself surfaces), then every target listed on the folklore board (the
// board is Reddit for transaction ids, and Elo is its feed order —
// specification §4). A post is eligible with text and/or media — video-only
// and photo-only archives must be able to earn Elo. Priorities ride in from
// the tip module's bulk read, decayed to the given day.

/** How many registered handles feed the pool — the newest-stamped first,
 * same order the public directory shows. */
const POOL_HANDLES = 50;

/** How many board members the pool reads to find listed targets — the front
 * page's own window, so the arena deals what the board shows. Profile
 * members inside the window are passed over; only link members count. */
const POOL_BOARD_WINDOW = 100;

/** A post on the table with its author — the pool before priorities. Shared
 * by the dealer (which adds tip priorities) and the directory's author
 * aggregate (which groups by author). */
export type PoolText = { postId: string; author: string };

/** True when the arena can deal this post: any non-empty caption, or any
 * media (photo / video). Pure — used by the pool and its tests. */
export function isArenaEligible(post: Pick<XPost, "text" | "media">): boolean {
  if (post.text.trim().length > 0) return true;
  return (post.media?.length ?? 0) > 0;
}

/** The author a target with no bound `by` is dealt under. Named from the
 * target itself, so the dealer can still pair it against a different author
 * (a same-author pair is dealt only when nothing else is on the table), and
 * shaped so it can never collide with a real handle — handles carry no
 * hyphen. Nobody is paid under it: an anonymous listing can move Elo and
 * cannot accrue kudos (specification §4). */
export const anonymousAuthor = (target: string): string => `anonymous-${target.slice(0, 8)}`;

/** The listed targets the arena can deal (specification §4): every board
 * link whose cached record names a target, once each. Version one treats
 * every listed target as eligible — a title is required to list, so there
 * is always text to show. A legacy web-address row names no target and is
 * not dealt. Empty when the board is empty or Redis is not configured. */
export async function listTargetTexts(): Promise<PoolText[]> {
  const entries = await boardTop(POOL_BOARD_WINDOW);
  const reads = await Promise.all(linkTxidsOf(entries).map((txid) => readLinkRecord(txid)));
  const texts = reads.flatMap((read): PoolText[] =>
    read.kind === "record" && read.record.kind === "link" && read.record.txid
      ? [
          {
            postId: read.record.txid,
            author: read.record.by ?? anonymousAuthor(read.record.txid),
          },
        ]
      : [],
  );
  // One row per target (specification, Decision 3), whatever the board
  // holds: the first entry in board order is the one dealt.
  return texts.filter(
    (text, i) => texts.findIndex((other) => other.postId === text.postId) === i,
  );
}

/** The posts the arena can deal at all — each registered handle's first
 * archive page, text and media posts included, then the board's listed
 * targets. Empty when nobody has registered or listed, or Redis is not
 * configured. */
export async function listPoolTexts(): Promise<PoolText[]> {
  const handles = await listHandles(POOL_HANDLES);
  const pages = await Promise.all(
    handles.map(async ({ handle }) => ({
      handle,
      page: await getArchivePage(handle, 0, PAGE_SIZE),
    })),
  );
  const archiveTexts = pages.flatMap(({ handle, page }) =>
    (page?.posts ?? [])
      .filter(isArenaEligible)
      .map((post) => ({ postId: post.id, author: handle })),
  );
  return [...archiveTexts, ...(await listTargetTexts())];
}

/** Assemble the deal pool as of `day`. Empty when nobody has registered, or
 * when Redis is not configured — the dealer then reports `insufficient`. */
export async function listDealCandidates(
  day: string = dateKey(),
): Promise<DealCandidate[]> {
  const texts = await listPoolTexts();
  const priorities = await readTipPriorities(
    texts.map((text) => text.postId),
    day,
  );
  return texts.map((text) => ({
    ...text,
    priority: priorities[text.postId] ?? 0,
  }));
}

/** The directory's author aggregate: each pool author's texts through the
 * fold's mean-of-top rule. A caller that already holds the rating table
 * passes it in; otherwise it is read here. Empty (so the directory keeps
 * its given order) when nobody has dueled or Redis is not configured. */
export async function readAuthorRatings(
  table?: RatingTable,
): Promise<Record<string, number>> {
  const texts = await listPoolTexts();
  const resolved = table ?? (await readRatingTable());
  const postsByAuthor = texts.reduce<Record<string, string[]>>((out, text) => {
    (out[text.author] ??= []).push(text.postId);
    return out;
  }, {});
  return authorRatings(resolved, postsByAuthor);
}
