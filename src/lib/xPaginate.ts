import type { XMedia } from "./xMedia";

const BASE = "https://api.twitter.com/2";

/**
 * X serves at most ~3200 most-recent tweets — 32 pages of 100. A hard cap so a
 * runaway or repeating cursor can never loop forever. This bounds the LOOP; it
 * has never bounded the COST.
 */
const PAGE_CEILING = 32;

/**
 * Pages a caller gets unless it asks for more, and pays for more.
 *
 * X bills per resource returned: $0.005 a post. A page is 100 posts, so a page
 * is 50 cents and the full 32 pages are $16. Defaulting to the ceiling meant one
 * unauthenticated request to /api/x/fetch cost up to $16, and /api/x/archive —
 * which pages the timeline twice — cost up to $32. The default is now one page,
 * so the expensive behaviour has to be asked for explicitly, in a call site a
 * reader can find.
 */
export const DEFAULT_MAX_PAGES = 1;

/** Posts X returns per page. One page is the unit of cost. */
export const POSTS_PER_PAGE = 100;

type TweetsPage<T> = {
  data?: T[];
  includes?: { media?: XMedia[] };
  meta?: { next_token?: string };
};

/**
 * Page through a user's whole tweets timeline, accumulating tweet data and any
 * media includes across pages up to the X API's ~3200-tweet ceiling. The timeline
 * endpoint returns at most 100 tweets per page plus a `meta.next_token` cursor;
 * this loops the cursor until it is absent, a page fails, or the page cap is hit.
 * The caller supplies the query params (tweet fields, expansions) and may inject a
 * fetch for testing. Pure of app state.
 */
export async function fetchAllUserTweets<T = unknown>(
  userId: string,
  token: string,
  params: string,
  fetchFn: typeof fetch = fetch,
  maxPages: number = DEFAULT_MAX_PAGES,
  sinceId?: string,
): Promise<{ data: T[]; media: XMedia[] }> {
  const data: T[] = [];
  const media: XMedia[] = [];
  let paginationToken: string | undefined;
  const pages = Math.max(1, Math.min(Math.floor(maxPages), PAGE_CEILING));

  for (let page = 0; page < pages; page++) {
    // since_id rides EVERY page: X bills per resource returned, so the bound
    // is what keeps a re-archive from re-buying posts already on chain — a
    // cursor without it would walk back into paid-for territory on page two.
    const url =
      `${BASE}/users/${userId}/tweets?max_results=100&${params}` +
      (sinceId ? `&since_id=${sinceId}` : "") +
      (paginationToken ? `&pagination_token=${paginationToken}` : "");
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) break;

    const body = (await res.json()) as TweetsPage<T>;
    if (Array.isArray(body.data)) data.push(...body.data);
    if (Array.isArray(body.includes?.media)) media.push(...body.includes.media);
    paginationToken = body.meta?.next_token;
    if (!paginationToken) break;
  }

  return { data, media };
}
