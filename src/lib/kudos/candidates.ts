import { dateKey } from "@/lib/redis";
import { listHandles } from "@/lib/xIndex";
import { getArchivePage, PAGE_SIZE } from "@/lib/xArchiveCache";
import { readTipPriorities } from "@/lib/kudos/tips";
import type { DealCandidate } from "./dealer";

// The dealer's candidate pool — which texts can be put on the table at all.
// Version one keeps it deliberately small: each registered handle's first
// archive page (its most recent PAGE_SIZE texts), so the pool tracks what
// the showroom itself surfaces. Bare-media posts are skipped — the arena
// deals texts. Priorities ride in from the tip module's bulk read, decayed
// to the given day.

/** How many registered handles feed the pool — the newest-stamped first,
 * same order the public directory shows. */
const POOL_HANDLES = 50;

/** Assemble the deal pool as of `day`. Empty when nobody has registered, or
 * when Redis is not configured — the dealer then reports `insufficient`. */
export async function listDealCandidates(
  day: string = dateKey(),
): Promise<DealCandidate[]> {
  const handles = await listHandles(POOL_HANDLES);
  const pages = await Promise.all(
    handles.map(async ({ handle }) => ({
      handle,
      page: await getArchivePage(handle, 0, PAGE_SIZE),
    })),
  );
  const texts = pages.flatMap(({ handle, page }) =>
    (page?.posts ?? [])
      .filter((post) => post.text.trim().length > 0)
      .map((post) => ({ postId: post.id, author: handle })),
  );
  const priorities = await readTipPriorities(
    texts.map((text) => text.postId),
    day,
  );
  return texts.map((text) => ({
    ...text,
    priority: priorities[text.postId] ?? 0,
  }));
}
