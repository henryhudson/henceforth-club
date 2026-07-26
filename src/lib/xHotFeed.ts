import { getArchivePage, type ArchivePage } from "@/lib/xArchiveCache";
import { readLedgerRollup } from "@/lib/xVotes";
import { sortPostsByHot } from "@/app/folklore/sortPosts";
import { DEFAULT_WINDOW } from "@/lib/xScore";

/**
 * One page of an archive in hot order. The rank is computed over the WHOLE
 * archive every time — a hot feed paged over chronological chunks would show
 * only the hot posts already scrolled past, the exact trap the media views
 * closed — and then sliced. The whole-archive read is bounded by X's own
 * per-profile export ceiling, and the ledger rollup is the same read the
 * profile page already does per request.
 *
 * Tips are deliberately not in the rank yet: they are a second store read
 * across every post id, and the hot fold's paid term should mean the paid
 * ledger. Fold them in when they earn the read.
 */
const WHOLE_ARCHIVE = 100_000;

export async function getHotArchivePage(
  handle: string,
  offset: number,
  limit: number,
  nowMs: number,
): Promise<ArchivePage | null> {
  const whole = await getArchivePage(handle, 0, WHOLE_ARCHIVE);
  if (!whole) return null;
  const { scoresByWindow } = await readLedgerRollup(handle);
  const ranked = sortPostsByHot(whole.posts, scoresByWindow[DEFAULT_WINDOW] ?? {}, nowMs);
  return { ...whole, posts: ranked.slice(offset, offset + limit) };
}
