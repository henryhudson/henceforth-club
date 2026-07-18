import { dateKey } from "@/lib/redis";
import { listHandles } from "@/lib/xIndex";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";
import type { XPost } from "@/app/folklore/parseArchive";
import { readTipPriorities } from "@/lib/kudos/tips";
import { authorRatings, type RatingTable } from "./elo";
import { readRatingTable } from "./ledger";
import type { DealCandidate } from "./dealer";

// The dealer's candidate pool — which posts can be put on the table at all.
// Version one keeps it deliberately small: each registered handle's first
// archive page (its most recent PAGE_SIZE posts), so the pool tracks what
// the showroom itself surfaces. A post is eligible with text and/or media —
// video-only and photo-only archives must be able to earn Elo. Priorities
// ride in from the tip module's bulk read, decayed to the given day.

/** How many registered handles feed the pool — the newest-stamped first,
 * same order the public directory shows. */
const POOL_HANDLES = 50;

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

/** The posts the arena can deal at all — each registered handle's first
 * archive page, text and media posts included. Empty when nobody has
 * registered or Redis is not configured. */
export async function listPoolTexts(): Promise<PoolText[]> {
  const handles = await listHandles(POOL_HANDLES);
  const pages = await Promise.all(
    handles.map(async ({ handle }) => ({
      handle,
      page: await getArchivePage(handle, 0, PAGE_SIZE),
    })),
  );
  return pages.flatMap(({ handle, page }) =>
    (page?.posts ?? [])
      .filter(isArenaEligible)
      .map((post) => ({ postId: post.id, author: handle })),
  );
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
